/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2024/5/18 13:49
 * @description 闪烁着色器材质
 */
import { DoubleSide, ShaderMaterial, Color } from "three";
import { useDispatchSignal } from "#/hooks";

const vertex = `
     uniform float uTime;
     uniform float uHeight;
     varying float vOpacity;

     void main() {
         vec3 vPosition = position;
         vOpacity = mix(1.0, 0.0, position.y / uHeight * 1.0) * (1.0 + sin(uTime) * 0.5);
         gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1);
     }
`;

const fragment = /*glsl*/`
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vOpacity;
    void main() {
        gl_FragColor = vec4(uColor, vOpacity * uOpacity);
    }
`;

export class FlickerShaderMaterial {
    static _ShaderMaterial: ShaderMaterial;
    static Name = "FlickerShaderMaterial";

    static get Material() {
        if (!FlickerShaderMaterial._ShaderMaterial) {
            FlickerShaderMaterial.Init();
        }
        return FlickerShaderMaterial._ShaderMaterial;
    }

    static set Material(value: ShaderMaterial) {
        FlickerShaderMaterial._ShaderMaterial = value;
    }

    static get PreviewMaterial() {
        return FlickerShaderMaterial.InstanceShaderMaterial();
    }

    static InstanceShaderMaterial() {
        const material = new ShaderMaterial({
            uniforms: {
                uTime: { value: 1.0 },
                uHeight: {
                    value: 10,
                },
                uOpacity: {
                    value: 0.5,
                },
                uColor: {
                    value: new Color("#00ffff"),
                }
            },
            vertexShader: vertex,
            fragmentShader: fragment,
            side: DoubleSide,
            transparent: true
        });
        material.name = FlickerShaderMaterial.Name;
        return material
    }

    static Init() {
        FlickerShaderMaterial._ShaderMaterial = FlickerShaderMaterial.InstanceShaderMaterial();

        useDispatchSignal("instantiateShaderMaterial", FlickerShaderMaterial);

        return FlickerShaderMaterial._ShaderMaterial;
    }

    static Update() {
        if (!FlickerShaderMaterial._ShaderMaterial) return;

        FlickerShaderMaterial._ShaderMaterial.uniforms.uTime.value += .02
    }

    static UpdatePreview(previewMaterial: ShaderMaterial) {
        previewMaterial.uniforms.uTime.value += .02
    }
}


