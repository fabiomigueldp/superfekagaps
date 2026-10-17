import { pixelLine } from '../../WorldPainting';
import { bullBoneY, type Box, type SkeletonBullModel } from './SkeletonBullModel';

/** Integer sprite poses keep the live footprint legible while the bone tumbles. */
function boneSprite(c: CanvasRenderingContext2D, bone: Box, pose: number, loose = false, echo = false) {
    const x = Math.round(bone.x), y = Math.round(bone.y);
    const r = (color: string, dx: number, dy: number, w: number, h: number) => {
        c.fillStyle = color; c.fillRect(x + dx, y + dy, w, h);
    };
    const outline = loose ? '#826461' : '#493444', ivory = loose ? '#d8c59c' : echo ? '#e1c6ef' : '#f0ddae';
    if (pose === 0) {
        r(outline, -1, -1, 5, 9); r(outline, 6, -1, 5, 9); r(outline, 3, 1, 4, 5);
        r(ivory, 2, 2, 6, 3); r(ivory, 0, 0, 3, 7); r(ivory, 7, 0, 3, 7);
        r('#fff1cf', 0, 0, 2, 2); r('#aa8564', 8, 4, 2, 3); r('#d6bb8d', 3, 4, 4, 1);
    } else {
        // Joint caps retain the projectile's extent. The cut-out silhouette
        // lets scenery show between the joints instead of painting a dark box.
        if (pose === 2) {
            r(outline, 0, -1, 10, 4); r(outline, 3, 1, 4, 5); r(outline, 0, 4, 10, 4);
            r(ivory, 1, 0, 8, 2); r(ivory, 4, 1, 2, 5); r(ivory, 1, 5, 8, 2);
            r('#fff1cf', 1, 0, 5, 1); r('#aa8564', 2, 6, 7, 1);
        } else {
            const top = pose === 1 ? 0 : 3, bottom = 3 - top;
            r(outline, -1, top - 1, 5, 6); r(outline, 6, bottom - 1, 5, 6);
            pixelLine(c, x + 2, y + top, x + 6, y + bottom, outline, 4);
            pixelLine(c, x + 2, y + top + 1, x + 7, y + bottom + 1, ivory, 2);
            r(ivory, 0, top, 3, 4); r(ivory, 7, bottom, 3, 4);
            r('#fff1cf', 0, top, 2, 1); r('#aa8564', 8, bottom + 3, 2, 1);
        }
    }
    r(loose ? '#b793c2' : echo ? '#d9a5ed' : '#9d51e5', 4, 2, 2, 2); r('#dcbbdf', 4, 2, 1, 1);
}

/** Release, shadow and contact dust all use the simulation's actual bones.
 * No particles or secondary clock can outlive a cancelled attack or a pause. */
export function drawBullBones(c: CanvasRenderingContext2D, b: SkeletonBullModel, reducedMotion: boolean) {
    const r = (color: string, x: number, y: number, w: number, h: number) => {
        c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h);
    };
    if (b.state === 'rattle' && (reducedMotion || b.stateTick >= 16)) {
        const drop = reducedMotion ? 12 : Math.min(12, Math.max(0, Math.floor((b.stateTick - 16) / 2)));
        for (const launch of b.boneLaunchPoses) boneSprite(c, { ...launch, y: launch.y - 12 + drop }, 0, true);
    }
    if (b.state === 'bones') for (const shot of b.boneShots) if (shot.delay > b.stateTick) {
        // The second rib remains visibly held until its own hoof stamp. Its
        // dull, stationary pose is distinct from the bright moving hazard.
        const lift = reducedMotion ? 0 : Math.min(3, Math.max(0, 8 - (shot.delay - b.stateTick)));
        boneSprite(c, { ...shot, y: shot.y - lift }, 0, true);
    }
    for (const bone of b.visibleBones) {
        if (bone.hopHeight > 0) {
            const height = Math.max(0, b.arena.floor - 9 - bone.y);
            const width = 10 - Math.round(5 * height / bone.hopHeight);
            r('#9b6b51', bone.x + (10 - width) / 2, b.arena.floor - 2, width, 1);
            const age = bone.age % bone.hopTicks;
            if (!reducedMotion && bone.age >= bone.hopTicks && age < 6) {
                const landing = bone.x - bone.vx * age + 5;
                if (landing >= b.arena.left && landing <= b.arena.right) {
                    r('#d5ab7c', landing - 4 - age, b.arena.floor - 3 - Math.floor(age / 3), 2, 1);
                    r('#d5ab7c', landing + 3 + age, b.arena.floor - 2 - Math.floor(age / 3), 2, 1);
                }
            }
            if (!reducedMotion) for (const behind of [2, 4]) if (bone.age >= behind) {
                const trailY = bullBoneY(b.arena.floor, bone.age - behind, true, bone.hopHeight, bone.hopTicks);
                r(behind === 2 ? '#c3a58b' : '#b49a80', bone.x - bone.vx * behind + 4, trailY + 3, 2, 1);
            }
        }
        const step = bone.hopHeight > 0 && !reducedMotion ? Math.floor(bone.age / 5) % 4 : 0;
        boneSprite(c, bone, bone.vx < 0 ? (4 - step) % 4 : step, false, bone.hopHeight > 0 && bone.shot === 1);
    }
    if (b.state === 'bones' && !reducedMotion) {
        for (const launch of b.boneShots) {
            const age = b.stateTick - launch.delay;
            if (age < 0 || age >= 8) continue;
            r('#d5ab7c', launch.x - 3 - age, b.arena.floor - 2 - Math.floor(age / 3), 2, 1);
            r('#d5ab7c', launch.x + 11 + age, b.arena.floor - 3 - Math.floor(age / 4), 2, 1);
        }
    }
}
