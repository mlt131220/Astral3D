/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2024/5/18 13:49
 * @description 动态棋盘着色器材质
 * @from  https://glslsandbox.com/e#109552.0
 */
import { DoubleSide, ShaderMaterial } from "three";
import { useDispatchSignal } from "#/hooks";

const vertex = `
varying vec2 vUv;

void main () {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
    `;

const fragment = /*glsl*/`
#ifdef GL_ES
precision mediump float;
#endif

varying vec2 vUv;
uniform float uTime;

void main() {
 vec2 uv = vUv;

 float cycle = fract(uTime);

 vec2 grid = vec2(10, 10);
 vec2 position = (uv * grid) - vec2(cycle,0);

 float color = 0.0;
 
 if (mod(position.y,2.0) < 1.0) {
  if (fract(position.x) < cycle) color = 1.0;
 } else {
  if (fract(position.x) > cycle) color = 1.0;
 }
 
 if (mod(floor(uTime), 2.0) < 1.0) color = 1.0 - color;
  
 gl_FragColor = vec4( color, color, color, 1.0 );
}`;

export class DynamicCheckerboardShaderMaterial {
    static _ShaderMaterial: ShaderMaterial;
    static Name = "DynamicCheckerboardShaderMaterial";

    static get Material() {
        if (!DynamicCheckerboardShaderMaterial._ShaderMaterial) {
            DynamicCheckerboardShaderMaterial.Init();
        }
        return DynamicCheckerboardShaderMaterial._ShaderMaterial;
    }

    static set Material(value: ShaderMaterial) {
        DynamicCheckerboardShaderMaterial._ShaderMaterial = value;
    }

    static get PreviewMaterial() {
        return DynamicCheckerboardShaderMaterial.InstanceShaderMaterial();
    }

    static InstanceShaderMaterial() {
        const material = new ShaderMaterial({
            uniforms: {
                uTime: {
                    value: 1.0
                }
            },
            vertexShader: vertex,
            fragmentShader: fragment,
            side: DoubleSide,
            transparent: true,
        });
        material.name = DynamicCheckerboardShaderMaterial.Name;
        return material;
    }

    static Init() {
        DynamicCheckerboardShaderMaterial._ShaderMaterial = DynamicCheckerboardShaderMaterial.InstanceShaderMaterial();

        useDispatchSignal("instantiateShaderMaterial", DynamicCheckerboardShaderMaterial);

        return DynamicCheckerboardShaderMaterial._ShaderMaterial;
    }

    static Update() {
        if (!DynamicCheckerboardShaderMaterial._ShaderMaterial) return;

        DynamicCheckerboardShaderMaterial._ShaderMaterial.uniforms.uTime.value += .01
    }

    static UpdatePreview(previewMaterial: ShaderMaterial) {
        previewMaterial.uniforms.uTime.value += .01
    }
}

