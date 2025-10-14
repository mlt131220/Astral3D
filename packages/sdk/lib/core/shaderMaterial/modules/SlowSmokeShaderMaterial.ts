/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2024/5/18 13:49
 * @description 动态烟着色器材质
 * @from https://glslsandbox.com/e#109550.0
 */
import { DoubleSide, ShaderMaterial, Vector2 } from "three";
import { useDispatchSignal } from "#/hooks";

const vertex = `
varying vec2 vUv;

void main () {
    vUv = uv;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /*glsl*/`
#ifdef GL_ES
precision highp float;
#endif

#define NUM_OCTAVES 6

varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;

mat3 rotX(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat3(
        1, 0, 0,
        0, c, -s,
        0, s, c
    );
}

mat3 rotY(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat3(
        c, 0, -s,
        0, 1, 0,
        s, 0, c
    );
}

float random(vec2 pos) {
    return fract(sin(dot(pos.xy, vec2(13.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 pos) {
    vec2 i = floor(pos);
    vec2 f = fract(pos);
    float a = random(i + vec2(0.0, 0.0));
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 pos) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < NUM_OCTAVES; i++) {
        float dir = mod(float(i), 2.0) > 0.5 ? 1.0 : -1.0;
        v += a * noise(pos - 0.05 * dir * uTime);

        pos = rot * pos * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main(void) {
    vec2 uv = vUv;
    vec2 p = (uv * 3.0 - 1.0) * 0.5;
    // 屏幕适配
    if (uResolution.x > uResolution.y) {
        p.x *= uResolution.x / uResolution.y;
    } else {
        p.y *= uResolution.y / uResolution.x;
    }
    
    p -= vec2(12.0, 0.0);

    float t = 0.0, d;

    float time2 = 1.0;

    vec2 q = vec2(0.0);
    q.x = fbm(p + 0.00 * time2);
    q.y = fbm(p + vec2(1.0));
    vec2 r = vec2(0.0);
    r.x = fbm(p + 1.0 * q + vec2(1.7, 1.2) + 0.15 * time2);
    r.y = fbm(p + 1.0 * q + vec2(8.3, 2.8) + 0.126 * time2);
    float f = fbm(p + r);

    vec3 color = mix(
        vec3(1.0, 1.0, 2.0),
        vec3(1.0, 1.0, 1.0),
        clamp((f * f) * 5.5, 1.2, 15.5)
    );

    color = mix(
        color,
        vec3(1.0, 1.0, 1.0),
        clamp(length(q), 2.0, 2.0)
    );

    color = mix(
        color,
        vec3(0.3, 0.2, 1.0),
        clamp(length(r.x), 0.0, 5.0)
    );

    color = (f * f * f * 1.0 + 0.5 * 1.7 * 0.0 + 0.9 * f) * color;

    float alpha = 50.0 - max(pow(100.0 * distance(uv.x, -1.0), 0.0), pow(2.0 * distance(uv.y, 0.5), 5.0));
    gl_FragColor = vec4(color * 100.0, color.r);
    gl_FragColor = vec4(color, alpha * color.r);
}
    `;

export class SlowSmokeShaderMaterial {
    static _ShaderMaterial: ShaderMaterial;
    static Name = "SlowSmokeShaderMaterial";

    static get Material() {
        if (!SlowSmokeShaderMaterial._ShaderMaterial) {
            SlowSmokeShaderMaterial.Init();
        }
        return SlowSmokeShaderMaterial._ShaderMaterial;
    }

    static set Material(value: ShaderMaterial) {
        SlowSmokeShaderMaterial._ShaderMaterial = value;
    }

    static get PreviewMaterial() {
        return SlowSmokeShaderMaterial.InstanceShaderMaterial();
    }

    static get Resolution() {
        const viewportDom = document.getElementById("viewport") as HTMLCanvasElement;
        return new Vector2(viewportDom.offsetWidth || window.innerWidth, viewportDom.offsetHeight || window.innerHeight);
    }

    static set Resolution(value: Vector2) {
        SlowSmokeShaderMaterial._ShaderMaterial.uniforms.uResolution.value.set(value.x, value.y);
    }

    static InstanceShaderMaterial() {
        const material = new ShaderMaterial({
            uniforms: {
                uTime: { value: 1.0 },
                uResolution: { value: SlowSmokeShaderMaterial.Resolution },
            },
            vertexShader: vertex,
            fragmentShader: fragment,
            side: DoubleSide,
            transparent: true,
        });
        material.name = SlowSmokeShaderMaterial.Name;
        return material;
    }

    static Init() {
        SlowSmokeShaderMaterial._ShaderMaterial = SlowSmokeShaderMaterial.InstanceShaderMaterial();

        useDispatchSignal("instantiateShaderMaterial", SlowSmokeShaderMaterial);

        return SlowSmokeShaderMaterial._ShaderMaterial;
    }

    static Update() {
        if (!SlowSmokeShaderMaterial._ShaderMaterial) return;

        SlowSmokeShaderMaterial._ShaderMaterial.uniforms.uTime.value += .01
    }

    static UpdatePreview(previewMaterial: ShaderMaterial) {
        previewMaterial.uniforms.uTime.value += .01
    }
}


