#!/usr/bin/env python3
"""DXEdge host health snapshot.

Runs on the droplet as root, once a day, from the dxedge-hostcheck systemd
timer (installed by scripts/health/install_host_check.sh, which deploy.yml
calls on every deploy).

Writes two files:

  1. A full report, root only, kept 35 days:
       /var/lib/dxedge/health/report-YYYY-MM-DD.json
     This one may hold source IPs (accepted and failed SSH logins). It never
     leaves the server.

  2. A public summary, if /etc/dxedge/health_token exists:
       /opt/dxedge/frontend/dist/health/host/<token>.json
     Counts and sizes only. No IP addresses, no usernames other than the
     count of distinct ones, no secrets, no command line arguments. The
     weekly Claude review reads it from https://dxedge.net/health/host/<token>.json.
     The token keeps the URL unlisted; the content is written so that it
     would do little harm if it leaked anyway.

Stdlib only. Every section is independent: a section that fails records its
error and the rest still run.
"""

import datetime as dt
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
from collections import Counter

STATE_DIR = "/var/lib/dxedge/health"
HISTORY = os.path.join(STATE_DIR, "history.json")
TOKEN_FILE = "/etc/dxedge/health_token"
PUBLIC_DIR = "/opt/dxedge/frontend/dist/health/host"
DATA_VOL = "/var/lib/docker/volumes/dxedge_dxedge-data/_data"
DEPLOY_LOG = "/var/log/dxedge_deploy.log"
CERT = "/etc/letsencrypt/live/dxedge.net/fullchain.pem"
KEEP_REPORTS_DAYS = 35
KEEP_HISTORY = 60

IPV4 = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
IPV6 = re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b")
HEXID = re.compile(r"\b[0-9a-f]{12,64}\b")
NUM = re.compile(r"\d+")


def run(cmd, timeout=60):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return p.stdout


def redact(line, limit=180):
    line = IPV4.sub("<ip>", line)
    line = IPV6.sub("<ip>", line)
    return line.strip()[:limit]


def shape(line):
    """Collapse numbers and ids so repeats of one message group together."""
    return NUM.sub("#", HEXID.sub("<id>", redact(line, 300)))[:160]


def mb(n_bytes):
    return round(n_bytes / 1048576, 1)


# ---------------------------------------------------------------- sections

def sec_system():
    with open("/proc/uptime") as f:
        up = float(f.read().split()[0])
    load = os.getloadavg()
    reboot = os.path.exists("/var/run/reboot-required")
    return {
        "uptime_days": round(up / 86400, 2),
        "load_1_5_15": [round(x, 2) for x in load],
        "cpus": os.cpu_count(),
        "reboot_required": reboot,
    }


def meminfo():
    m = {}
    with open("/proc/meminfo") as f:
        for line in f:
            k, v = line.split(":", 1)
            m[k] = int(v.split()[0]) * 1024
    return m


def vmstat():
    v = {}
    with open("/proc/vmstat") as f:
        for line in f:
            k, val = line.split()
            v[k] = int(val)
    return v


def cpu_times():
    with open("/proc/stat") as f:
        parts = f.readline().split()[1:]
    return [int(x) for x in parts]


def sec_memory(sample_s=10):
    m = meminfo()
    v1, c1 = vmstat(), cpu_times()
    time.sleep(sample_s)
    v2, c2 = vmstat(), cpu_times()
    page = os.sysconf("SC_PAGE_SIZE")
    swin = (v2["pswpin"] - v1["pswpin"]) * page / sample_s
    swout = (v2["pswpout"] - v1["pswpout"]) * page / sample_s
    d = [b - a for a, b in zip(c1, c2)]
    total = sum(d) or 1
    # user nice system idle iowait irq softirq steal
    return {
        "ram_total_mb": mb(m["MemTotal"]),
        "ram_available_mb": mb(m["MemAvailable"]),
        "ram_used_pct": round(100 * (1 - m["MemAvailable"] / m["MemTotal"]), 1),
        "swap_total_mb": mb(m["SwapTotal"]),
        "swap_used_mb": mb(m["SwapTotal"] - m["SwapFree"]),
        "swap_in_kb_s": round(swin / 1024, 1),
        "swap_out_kb_s": round(swout / 1024, 1),
        "swap_pages_in_since_boot": v2["pswpin"],
        "swap_pages_out_since_boot": v2["pswpout"],
        "sample_seconds": sample_s,
        "cpu_pct": {
            "user": round(100 * (d[0] + d[1]) / total, 1),
            "system": round(100 * (d[2] + d[5] + d[6]) / total, 1),
            "idle": round(100 * d[3] / total, 1),
            "iowait": round(100 * d[4] / total, 1),
            "steal": round(100 * (d[7] if len(d) > 7 else 0) / total, 1),
        },
    }


def sec_processes(top=8):
    procs = []
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            with open(f"/proc/{pid}/status") as f:
                st = dict(l.split(":", 1) for l in f if ":" in l)
            rss = int(st.get("VmRSS", "0 kB").split()[0]) * 1024
            swap = int(st.get("VmSwap", "0 kB").split()[0]) * 1024
            name = st["Name"].strip()
            # The script or binary being run, never its arguments.
            with open(f"/proc/{pid}/cmdline", "rb") as f:
                argv = [a.decode(errors="replace") for a in f.read().split(b"\0") if a]
            prog = name
            if argv:
                prog = os.path.basename(argv[0])
                if prog.startswith("python") and len(argv) > 1 and not argv[1].startswith("-"):
                    prog = f"{prog} {os.path.basename(argv[1])}"
            try:
                cwd = os.readlink(f"/proc/{pid}/cwd")
            except OSError:
                cwd = ""
            with open(f"/proc/{pid}/stat") as f:
                fields = f.read().rsplit(")", 1)[1].split()
            procs.append({
                "pid": int(pid),
                "prog": prog[:60],
                "cwd": cwd[:80],
                "state": fields[0],
                "rss_mb": mb(rss),
                "swap_mb": mb(swap),
                "cpu_s": round((int(fields[11]) + int(fields[12])) / os.sysconf("SC_CLK_TCK")),
            })
        except (OSError, ValueError, KeyError, IndexError):
            continue
    by_mem = sorted(procs, key=lambda p: p["rss_mb"] + p["swap_mb"], reverse=True)[:top]
    by_cpu = sorted(procs, key=lambda p: p["cpu_s"], reverse=True)[:5]
    return {"top_memory": by_mem, "top_cpu_time": by_cpu, "count": len(procs),
            "stuck_in_D": sum(1 for p in procs if p["state"] == "D")}


def sec_disk():
    out = {}
    for mount in ("/", "/boot"):
        try:
            s = os.statvfs(mount)
            total = s.f_blocks * s.f_frsize
            free = s.f_bavail * s.f_frsize
            out[mount] = {
                "size_gb": round(total / 1e9, 1),
                "free_gb": round(free / 1e9, 1),
                "used_pct": round(100 * (1 - s.f_bavail / s.f_blocks), 1),
                "inodes_used_pct": round(100 * (1 - s.f_favail / s.f_files), 1) if s.f_files else None,
            }
        except OSError as e:
            out[mount] = {"error": str(e)}

    def du(path):
        try:
            return round(int(run(["du", "-sxb", path], timeout=120).split()[0]) / 1e9, 2)
        except Exception:
            return None

    out["big_dirs_gb"] = {p: du(p) for p in ("/var/lib/docker", "/var/log", "/opt", "/var/lib/dxedge")}
    try:
        j = run(["journalctl", "--disk-usage"])
        out["journal"] = j.strip().split("take up ", 1)[-1].split(" in")[0]
    except Exception:
        pass
    return out


def sec_databases():
    out = {}
    if not os.path.isdir(DATA_VOL):
        return {"error": "data volume not found"}
    for name in sorted(os.listdir(DATA_VOL)):
        p = os.path.join(DATA_VOL, name)
        if os.path.isfile(p):
            out[name] = mb(os.path.getsize(p))
    db = os.path.join(DATA_VOL, "dxedge.db")
    tables = {}
    if os.path.exists(db):
        try:
            c = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=10)
            for (t,) in c.execute("select name from sqlite_master where type='table'"):
                try:
                    # max(rowid) is an index lookup, not a scan: cheap on a 16 GB file.
                    tables[t] = c.execute(f'select max(rowid) from "{t}"').fetchone()[0]
                except sqlite3.Error:
                    tables[t] = None
            c.close()
        except sqlite3.Error as e:
            tables = {"error": str(e)[:120]}
    return {"files_mb": out, "dxedge_db_max_rowid": tables}


def sec_docker():
    out = {"containers": [], "df": []}
    for line in run(["docker", "ps", "-a", "--format", "{{json .}}"]).splitlines():
        d = json.loads(line)
        out["containers"].append({"name": d.get("Names"), "state": d.get("State"),
                                  "status": d.get("Status"), "image": d.get("Image")})
    for line in run(["docker", "system", "df", "--format", "{{json .}}"]).splitlines():
        d = json.loads(line)
        out["df"].append({k: d.get(k) for k in ("Type", "TotalCount", "Active", "Size", "Reclaimable")})
    stats = run(["docker", "stats", "--no-stream", "--format", "{{json .}}"], timeout=90)
    out["stats"] = [{k: json.loads(l).get(k) for k in ("Name", "CPUPerc", "MemUsage", "BlockIO")}
                    for l in stats.splitlines()]
    return out


def container_errors(name, since="24h"):
    p = subprocess.run(["docker", "logs", "--since", since, name],
                       capture_output=True, text=True, timeout=120)
    if p.returncode != 0:
        raise RuntimeError(redact(p.stderr, 120) or f"docker logs exit {p.returncode}")
    lines = (p.stdout + p.stderr).splitlines()
    pat = re.compile(r"\b(ERROR|CRITICAL|Traceback|Exception|\[error\]|\[crit\]|\[emerg\])", re.I)
    errs = [l for l in lines if pat.search(l)]
    return len(lines), errs


def sec_logs():
    out = {}
    # Backend application errors.
    try:
        n, errs = container_errors("dxedge-backend")
        out["backend_24h"] = {"lines": n, "errors": len(errs),
                              "top": Counter(shape(e) for e in errs).most_common(6)}
    except Exception as e:
        out["backend_24h"] = {"error": str(e)[:120]}
    # nginx: status classes from the access log, plus nginx's own error lines.
    try:
        p = subprocess.run(["docker", "logs", "--since", "24h", "dxedge-nginx"],
                           capture_output=True, text=True, timeout=120)
        if p.returncode != 0:
            raise RuntimeError(redact(p.stderr, 120) or f"docker logs exit {p.returncode}")
        status = Counter()
        five = Counter()
        for l in p.stdout.splitlines():
            m = re.search(r'"\s(\d{3})\s', l)
            if m:
                code = m.group(1)
                status[code[0] + "xx"] += 1
                if code[0] == "5":
                    r = re.search(r'"[A-Z]+ ([^ ?"]+)', l)
                    five[(code, r.group(1)[:60] if r else "?")] += 1
        nerr = [l for l in p.stderr.splitlines() if re.search(r"\[(error|crit|alert|emerg)\]", l)]
        out["nginx_24h"] = {
            "requests_by_class": dict(status),
            "top_5xx": [[f"{c} {path}", n] for (c, path), n in five.most_common(6)],
            "error_lines": len(nerr),
            "top_errors": Counter(shape(l) for l in nerr).most_common(6),
        }
    except Exception as e:
        out["nginx_24h"] = {"error": str(e)[:120]}
    # System journal, error priority and worse, last 24 hours.
    try:
        units = Counter()
        msgs = Counter()
        for l in run(["journalctl", "-p", "err", "--since", "-24h", "-o", "json", "--no-pager"],
                     timeout=120).splitlines():
            try:
                d = json.loads(l)
            except ValueError:
                continue
            u = d.get("_SYSTEMD_UNIT") or d.get("SYSLOG_IDENTIFIER") or "kernel"
            units[u] += 1
            msg = d.get("MESSAGE")
            if isinstance(msg, str):
                msgs[f"{u}: {shape(msg)}"] += 1
        out["journal_errors_24h"] = {"total": sum(units.values()),
                                     "by_unit": units.most_common(8),
                                     "top": msgs.most_common(6)}
    except Exception as e:
        out["journal_errors_24h"] = {"error": str(e)[:120]}
    # Kernel: out of memory kills in the last 7 days.
    try:
        k = run(["journalctl", "-k", "--since", "-7d", "--no-pager"], timeout=120)
        out["oom_kills_7d"] = len(re.findall(r"Out of memory|oom-kill:|Killed process", k))
    except Exception as e:
        out["oom_kills_7d"] = {"error": str(e)[:120]}
    # Failed systemd units.
    try:
        failed = run(["systemctl", "--failed", "--no-legend", "--plain"]).split("\n")
        out["failed_units"] = [l.split()[0] for l in failed if l.strip()]
    except Exception as e:
        out["failed_units"] = {"error": str(e)[:120]}
    return out


def sec_ssh():
    """Counts for the public summary; detail with IPs for the private report."""
    since = "-7d"
    text = run(["journalctl", "--since", since, "--no-pager", "-o", "short-iso",
                "_COMM=sshd", "+", "_COMM=sshd-session", "+", "SYSLOG_IDENTIFIER=sshd"], timeout=180)
    accepted = []
    failed_ips = Counter()
    failed = invalid = 0
    for l in text.splitlines():
        m = re.search(r"Accepted (\S+) for (\S+) from (\S+)", l)
        if m:
            accepted.append({"when": l[:25], "method": m.group(1), "user": m.group(2), "ip": m.group(3)})
            continue
        if "Failed password" in l or "Failed publickey" in l:
            failed += 1
            ip = IPV4.search(l)
            if ip:
                failed_ips[ip.group(0)] += 1
        elif "Invalid user" in l:
            invalid += 1
    try:
        cfg = run(["sshd", "-T"])
        conf = {k: v for k, v in (l.split(None, 1) for l in cfg.splitlines() if " " in l)
                if k in ("port", "permitrootlogin", "passwordauthentication",
                         "kbdinteractiveauthentication", "pubkeyauthentication", "maxauthtries")}
    except Exception:
        conf = {}
    try:
        f2b = run(["fail2ban-client", "status"]) if shutil.which("fail2ban-client") else ""
    except Exception:
        f2b = ""
    public = {
        "window": "7d",
        "accepted_by_method": dict(Counter(a["method"] for a in accepted)),
        "accepted_distinct_sources": len({a["ip"] for a in accepted}),
        "accepted_password_logins": sum(1 for a in accepted if a["method"] == "password"),
        "failed_auth": failed,
        "invalid_user_attempts": invalid,
        "distinct_failed_sources": len(failed_ips),
        "sshd": conf,
        "fail2ban": bool(f2b),
    }
    private = {"accepted": accepted[-50:], "top_failed_sources": failed_ips.most_common(20)}
    return public, private


def sec_deploy():
    out = {}
    try:
        head = run(["git", "-C", "/opt/dxedge", "rev-parse", "--short", "HEAD"]).strip()
        out["droplet_head"] = head
        when = run(["git", "-C", "/opt/dxedge", "log", "-1", "--format=%cI"]).strip()
        out["droplet_head_date"] = when
    except Exception:
        pass
    try:
        with open(DEPLOY_LOG, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 200_000))
            tail = f.read().decode(errors="replace").splitlines()
        completes = [l for l in tail if "Deploy complete" in l]
        errors = [l for l in tail if "ERROR" in l]
        out["last_deploy_complete"] = redact(completes[-1]) if completes else None
        out["recent_deploy_errors"] = [redact(e) for e in errors[-5:]]
    except OSError:
        out["deploy_log"] = "missing"
    try:
        t = run(["systemctl", "is-active", "dxedge-deploy.timer"]).strip()
        out["auto_deploy_timer"] = t
    except Exception:
        pass
    return out


def sec_cert():
    try:
        end = run(["openssl", "x509", "-enddate", "-noout", "-in", CERT]).strip().split("=", 1)[1]
        exp = dt.datetime.strptime(end, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=dt.timezone.utc)
        return {"expires": exp.date().isoformat(),
                "days_left": (exp - dt.datetime.now(dt.timezone.utc)).days}
    except Exception as e:
        return {"error": str(e)[:120]}


def sec_updates():
    try:
        out = run(["apt-get", "-s", "-o", "Debug::NoLocking=1", "upgrade"], timeout=180)
        pkgs = [l for l in out.splitlines() if l.startswith("Inst ")]
        sec = [l for l in pkgs if "security" in l.lower()]
        return {"upgradable": len(pkgs), "security": len(sec)}
    except Exception as e:
        return {"error": str(e)[:120]}


# ---------------------------------------------------------------- main

def section(report, key, fn):
    t = time.time()
    try:
        report[key] = fn()
    except Exception as e:  # one broken section must not sink the run
        report[key] = {"error": f"{type(e).__name__}: {str(e)[:160]}"}
    report["_timing_s"][key] = round(time.time() - t, 1)


def write_json(path, obj, mode):
    tmp = f"{path}.tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=1, default=str)
    os.chmod(tmp, mode)
    os.replace(tmp, path)


def main():
    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc)
    report = {"schema": 1, "generated_at": now.isoformat(timespec="seconds"), "_timing_s": {}}
    section(report, "system", sec_system)
    section(report, "memory", sec_memory)
    section(report, "processes", sec_processes)
    section(report, "disk", sec_disk)
    section(report, "databases", sec_databases)
    section(report, "docker", sec_docker)
    section(report, "logs", sec_logs)
    ssh_private = {}
    try:
        report["ssh"], ssh_private = sec_ssh()
    except Exception as e:
        report["ssh"] = {"error": str(e)[:160]}
    section(report, "deploy", sec_deploy)
    section(report, "cert", sec_cert)
    section(report, "updates", sec_updates)

    # Trend history: a few numbers per day, so the weekly review sees direction.
    try:
        hist = json.load(open(HISTORY))
    except (OSError, ValueError):
        hist = []
    mem, disk, dbs = report.get("memory", {}), report.get("disk", {}).get("/", {}), report.get("databases", {})
    hist.append({
        "date": now.date().isoformat(),
        "ram_used_pct": mem.get("ram_used_pct"),
        "swap_used_mb": mem.get("swap_used_mb"),
        "swap_io_kb_s": (mem.get("swap_in_kb_s") or 0) + (mem.get("swap_out_kb_s") or 0),
        "iowait_pct": (mem.get("cpu_pct") or {}).get("iowait"),
        "disk_used_pct": disk.get("used_pct"),
        "disk_free_gb": disk.get("free_gb"),
        "dxedge_db_mb": (dbs.get("files_mb") or {}).get("dxedge.db"),
        "ssh_failed_7d": report.get("ssh", {}).get("failed_auth"),
        "backend_errors_24h": report.get("logs", {}).get("backend_24h", {}).get("errors"),
    })
    hist = [h for i, h in enumerate(hist) if h["date"] not in {x["date"] for x in hist[i + 1:]}]
    hist = hist[-KEEP_HISTORY:]
    write_json(HISTORY, hist, 0o600)
    report["history"] = hist

    # Private full report, then prune old ones.
    private = dict(report, ssh_detail=ssh_private)
    write_json(os.path.join(STATE_DIR, f"report-{now.date().isoformat()}.json"), private, 0o600)
    cutoff = time.time() - KEEP_REPORTS_DAYS * 86400
    for f in os.listdir(STATE_DIR):
        p = os.path.join(STATE_DIR, f)
        if f.startswith("report-") and os.path.getmtime(p) < cutoff:
            os.remove(p)

    # Public summary at the unlisted URL.
    try:
        token = open(TOKEN_FILE).read().strip()
    except OSError:
        token = ""
    if re.fullmatch(r"[A-Za-z0-9_-]{24,}", token):
        os.makedirs(PUBLIC_DIR, mode=0o755, exist_ok=True)
        write_json(os.path.join(PUBLIC_DIR, f"{token}.json"), report, 0o644)
        print("published summary")
    else:
        print("no valid token in", TOKEN_FILE, "- summary not published")
    print("report written:", report["generated_at"], "timings", report["_timing_s"])


if __name__ == "__main__":
    sys.exit(main())
