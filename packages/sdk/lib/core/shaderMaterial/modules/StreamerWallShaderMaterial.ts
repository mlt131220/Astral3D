/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2024/5/18 13:49
 * @description 流光墙着色器材质
 * @from http://t.csdnimg.cn/zSxq0
 */
import { DoubleSide, ShaderMaterial, RepeatWrapping, TextureLoader } from "three";
import { useDispatchSignal } from "#/hooks";

const vertex = `
     varying vec2 vUv;
     varying vec3 vPosition;
     void main(){
           vUv = uv;
           vPosition = position;
           vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
           gl_Position = projectionMatrix * mvPosition;
     }
`;

const fragment = /*glsl*/`
    varying vec2 vUv;
    uniform float uTime;
    uniform sampler2D uFlowTexture;
    uniform sampler2D uBgTexture;
    void main( void ) {
         vec2 position = vUv;
         vec4 colorA = texture2D(uFlowTexture, vec2(vUv.x, fract(vUv.y - uTime)));
         vec4 colorB = texture2D(uBgTexture, position.xy);
         gl_FragColor = colorB + colorB * colorA;
    }
`;

export class StreamerWallShaderMaterial {
    static _ShaderMaterial: ShaderMaterial;
    static Name = "StreamerWallShaderMaterial";

    static get Material() {
        if (!StreamerWallShaderMaterial._ShaderMaterial) {
            StreamerWallShaderMaterial.Init();
        }
        return StreamerWallShaderMaterial._ShaderMaterial;
    }

    static set Material(value: ShaderMaterial) {
        StreamerWallShaderMaterial._ShaderMaterial = value;
    }

    static get PreviewMaterial() {
        return StreamerWallShaderMaterial.InstanceShaderMaterial();
    }

    static InstanceShaderMaterial() {
        const bgTexture = new TextureLoader().load("/static/images/resource/material/shader/texture2D/GradationBlue.png");

        const flowTexture = new TextureLoader().load("/static/images/resource/material/shader/texture2D/FlowTexture.png");
        flowTexture.wrapS = RepeatWrapping;

        const material = new ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uFlowTexture: { value: flowTexture },
                uBgTexture: { value: bgTexture }
            },
            vertexShader: vertex,
            fragmentShader: fragment,
            side: DoubleSide,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        material.name = StreamerWallShaderMaterial.Name;
        return material;
    }

    static Init() {
        StreamerWallShaderMaterial._ShaderMaterial = StreamerWallShaderMaterial.InstanceShaderMaterial();

        useDispatchSignal("instantiateShaderMaterial", StreamerWallShaderMaterial);

        return StreamerWallShaderMaterial._ShaderMaterial;
    }

    static Update() {
        if (!StreamerWallShaderMaterial._ShaderMaterial) return;

        StreamerWallShaderMaterial._ShaderMaterial.uniforms.uTime.value += .01
    }

    static UpdatePreview(previewMaterial: ShaderMaterial) {
        previewMaterial.uniforms.uTime.value += .01
    }
}


