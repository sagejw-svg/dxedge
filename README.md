# DXEdge

Live HF propagation, band conditions, DX cluster spots, and PSKReporter data for amateur radio operators.

**Live at:** https://dxedge.com

## Features

- Real-time solar indices (NOAA SWPC)
- Band conditions for 160m-6m
- DX cluster spots via telnet (live feed)
- PSKReporter reception reports by grid square
- DX windows by region from CM95
- LoTW integration - loads confirmed QSOs and highlights needed DXCC entities
- No user accounts, no stored personal data

## Stack

- **Backend:** FastAPI (Python 3.12), aiohttp, uvicorn
- **Frontend:** React 18, Vite
- **Proxy:** nginx with SSL
- **Deployment:** Docker Compose on DigitalOcean

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # proxies /api to localhost:8000
```

## Production Deploy

### 1. Spin up a droplet
- DigitalOcean, Ubuntu 24.04, $8/mo (1GB RAM)
- Add DNS A records pointing dxedge.com and www.dxedge.com at droplet IP

### 2. Push this repo to GitHub

### 3. SSH into droplet and run:
```bash
curl -O https://raw.githubusercontent.com/YOUR_GITHUB/dxedge/main/scripts/bootstrap.sh
bash bootstrap.sh
```

That's it. Bootstrap installs Docker, builds the frontend, gets SSL, and starts the stack.

### Update after code changes
```bash
cd /opt/dxedge
git pull
cd frontend && npm run build && cd ..
docker compose up -d --build
```

## Data Sources

| Source | Data | Refresh |
|--------|------|---------|
| NOAA SWPC | K-index, SFI, SSN | 15 min |
| DX Cluster telnet | Spots | Real-time |
| PSKReporter | FT8/FT4 reception | 5 min |
| LoTW | Confirmed QSOs | On demand |

## License

MIT - free to use, fork, and build on.

73 de K6WRJ
