import { mapToScreen, type MapCamera } from './WorldMapModel';
import { VESSEL_WAKE_INTERVAL, VESSEL_WAKE_LIFETIME, VESSEL_WAKE_LIMIT, type VesselMotion, type VesselWakeSample } from './WorldVesselMotion';

/** Foam remains in the water after the hull turns, brakes or docks. A bounded
 * history replaces particle allocation, and all widths follow the map zoom. */
export function paintVesselWake(c: CanvasRenderingContext2D, camera: MapCamera, motion: VesselMotion, scale: number, time: number): void {
    const samples = motion.wake?.slice(-VESSEL_WAKE_LIMIT);
    if (!samples?.length) return;
    const point = (sample: VesselWakeSample, side: number) => {
        const age = Math.max(0, (time - sample.time) / VESSEL_WAKE_LIFETIME);
        const p = mapToScreen(sample.point, camera), spread = (2.4 + age * 12) * scale;
        return { x: p.x - Math.sin(sample.heading) * spread * side,
            y: p.y + Math.cos(sample.heading) * spread * side, age };
    };
    c.save(); c.lineCap = 'round';
    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i], age = (time - sample.time) / VESSEL_WAKE_LIFETIME;
        if (age < 0 || age >= 1) continue;
        const opacity = sample.strength * (1 - age) ** 2;
        const next = samples[i + 1];
        if (next && next.time - sample.time <= VESSEL_WAKE_INTERVAL * 1.5) {
            c.strokeStyle = `rgba(206,239,220,${opacity * .32})`;
            c.lineWidth = (.65 + age * 1.3) * scale;
            c.beginPath();
            for (const side of [-1, 1]) {
                const a = point(sample, side), b = point(next, side);
                c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
            }
            c.stroke();
        }
        // Uneven propeller churn between the diverging shoulders. The seed is
        // emission time, never the changing index in the surviving history.
        if (Math.round(sample.time / VESSEL_WAKE_INTERVAL) % 2 === 0) {
            const p = point(sample, Math.sin(sample.time * .031) * .45);
            c.fillStyle = `rgba(217,242,228,${opacity * .21})`;
            c.beginPath(); c.ellipse(p.x, p.y, (1.4 + age * 3.2) * scale,
                (.65 + age * 1.4) * scale, sample.heading, 0, Math.PI * 2); c.fill();
        }
    }
    c.restore();
}

/** The short pressure wave hugs the bow; only the older wake spreads outward.
 * Avoid a water effect for a boat at rest or reversing through a gangway. */
export function paintVesselBow(c: CanvasRenderingContext2D, camera: MapCamera, motion: VesselMotion, scale: number): void {
    const speed = Math.max(0, Math.min(1, motion.speed));
    if (speed <= 0) return;
    const p = mapToScreen(motion.waterline, camera), strength = speed * speed;
    c.save(); c.translate(p.x, p.y); c.rotate(motion.screenHeading);
    c.strokeStyle = `rgba(223,246,229,${strength * .48})`; c.lineWidth = .85 * scale; c.lineCap = 'round';
    for (const side of [-1, 1]) {
        c.beginPath(); c.moveTo(23 * scale, side * .8 * scale);
        c.quadraticCurveTo(21 * scale, side * (3 + strength) * scale, 15 * scale, side * (4.5 + strength * 2) * scale); c.stroke();
    }
    c.restore();
}
