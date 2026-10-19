/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
  DXEdge copy (Anode): dial text uses the site mono stack. See CHANGES.md.
*/
function clamp(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
export function Dial(bounds, text, dialColor = "red", textColor = "white") {
    const element = document.createElement("canvas");
    element.classList.add("dial");
    element.tabIndex = 0;
    element.setAttribute("role", "slider");
    element.setAttribute("aria-label", text || "Dial");
    element.setAttribute("aria-valuemin", String(bounds[0]));
    element.setAttribute("aria-valuemax", String(bounds[1]));
    element.title = (text || "Dial") + ". Drag to turn. Hold Shift for a finer move. Arrow keys and the mouse wheel work while it is focused.";
    const w = element.width = 70;
    const h = element.height = 50;
    const size = 20;
    const g = element.getContext("2d");
    let normalizedValue = 0.5;
    let previousNormalisedValue = 0.5;
    let fadeCounter = 0;
    let fadeTimerHandler = null;
    function paint() {
        g.clearRect(0, 0, w, h);
        const arc = [Math.PI * 0.8, Math.PI * 2.2];
        g.strokeStyle = dialColor;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(w / 2, h / 2, size, arc[0], arc[1]);
        g.stroke();
        g.lineWidth = w / 8;
        const pos = arc[0] + normalizedValue * (arc[1] - arc[0]);
        g.beginPath();
        g.arc(w / 2, h / 2, size, pos - 0.2, pos + 0.2);
        g.stroke();
        if (fadeCounter > 0) {
            g.strokeStyle = "rgba(0,255,0," + clamp(fadeCounter / 10) + ")";
            g.lineWidth = w / 8;
            const pos = arc[0] + normalizedValue * (arc[1] - arc[0]);
            g.beginPath();
            g.arc(w / 2, h / 2, size, pos - 0.2, pos + 0.2);
            g.stroke();
        }
        if (text) {
            g.fillStyle = textColor;
            g.font = "10px ui-monospace, monospace";
            const tw = g.measureText(text).width;
            g.fillText(text, w / 2 - tw / 2, h / 2 + size);
        }
    }
    function fade(frames) {
        if (fadeTimerHandler)
            window.clearInterval(fadeTimerHandler);
        fadeCounter = Math.min(frames, 10);
        fadeTimerHandler = window.setInterval(() => {
            fadeCounter--;
            paint();
        }, 100);
    }
    function normalise(v) {
        return (v - bounds[0]) / (bounds[1] - bounds[0]);
    }
    function denormalise(n) {
        return bounds[0] + (bounds[1] - bounds[0]) * n;
    }
    function setValue(n) {
        normalizedValue = normalise(n);
        element.setAttribute("aria-valuenow", String(denormalise(normalizedValue)));
        paint();
        if (Math.abs(normalizedValue - previousNormalisedValue) > 0.002) {
            fade(4 + Math.floor(Math.abs(normalizedValue - previousNormalisedValue) / 0.001));
        }
        previousNormalisedValue = normalizedValue;
    }
    function getValue() {
        return denormalise(normalizedValue);
    }
    const state = { isDragging: false, fine: false, handler: [(v) => { }] };
    function bind(h) {
        state.handler.push(h);
    }
    function turn(delta) {
        normalizedValue = clamp(normalizedValue + delta);
        const actualValue = denormalise(normalizedValue);
        setValue(actualValue);
        state.handler.forEach(h => h(actualValue));
    }
    element.addEventListener("mousedown", (e) => {
        state.isDragging = true;
        state.fine = e.shiftKey;
        element.focus();
    });
    window.addEventListener("mousemove", (e) => {
        if (state.isDragging) {
            const scale = (e.shiftKey || state.fine) ? 400 : 100;
            turn((e.movementX - e.movementY) / scale);
        }
    });
    window.addEventListener("mouseup", () => {
        state.isDragging = false;
        state.fine = false;
    });
    element.addEventListener("wheel", (e) => {
        if (document.activeElement !== element) return;
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.04;
        turn(e.deltaY > 0 ? -step : step);
    }, { passive: false });
    element.addEventListener("keydown", (e) => {
        const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        e.stopPropagation();
        turn(dir * (e.shiftKey ? 0.01 : 0.04));
    });
    paint();
    return {
        element,
        get value() { return getValue(); },
        set value(v) { setValue(v); },
        bind
    };
}
