/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2024/5/18 13:49
 * @description 圆网格着色器材质
 * @from https://www.shadertoy.com/view/7dG3zy
 */
import { DoubleSide, ShaderMaterial } from "three";
import { useDispatchSignal } from "#/hooks";

const vertex = `
varying vec2 vUv;

void main () {
    vUv = uv;
    
    // 从贴图中采样颜色值
    // vec3 newPosition = normal*vec3(0,0,0)+position;
    //gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
    `;

const fragment = /*glsl*/`
// 片元着色器中所有浮点数精度为中精度
precision mediump float;

varying vec2 vUv;
uniform float uTime;

vec3 palette( float t ) {
 vec3 a = vec3(0.5, 0.5, 0.5);
 vec3 b = vec3(0.5, 0.5, 0.5);
 vec3 c = vec3(1.0, 1.0, 1.0);
 vec3 d = vec3(0.263,0.416,0.557);

 return a + b*cos( 6.28318*(c*t+d) );
}

void main() {
    vec2 uv = vUv;
    uv-=.5;  // 使坐标范围从-0.5到0.5
    uv*=3.;  // 使坐标范围从-1.5到1.5
    vec2 uv0 = uv;
    vec3 finalColor = vec3(0.0);
    
    for (float i = 0.0; i < 4.0; i++) {
        uv = fract(uv * 1.5) - 0.5;
        float d = length(uv) * exp(-length(uv0));

        vec3 col = palette(length(uv0) + i*.4 + uTime*.4);

        d = sin(d*8. + uTime)/8.;
        d = abs(d);

        d = pow(0.01 / d, 1.2);

        finalColor += col * d;
    }
 
  gl_FragColor = vec4(finalColor,1.);
}
    `;

export class CircleGridShaderMaterial {
    static _ShaderMaterial: ShaderMaterial;
    static Name = "CircleGridShaderMaterial";

    static get Material() {
        if (!CircleGridShaderMaterial._ShaderMaterial) {
            CircleGridShaderMaterial.Init();
        }
        return CircleGridShaderMaterial._ShaderMaterial;
    }

    static set Material(value: ShaderMaterial) {
        CircleGridShaderMaterial._ShaderMaterial = value;
    }

    static get PreviewMaterial() {
        return CircleGridShaderMaterial.InstanceShaderMaterial();
    }

    static InstanceShaderMaterial() {
        const material = new ShaderMaterial({
            uniforms: {
                uTime: { value: 1.0 },
            },
            vertexShader: vertex,
            fragmentShader: fragment,
            side: DoubleSide,
            transparent: true,
        });
        material.name = CircleGridShaderMaterial.Name;
        return material;
    }

    static Init() {
        CircleGridShaderMaterial._ShaderMaterial = CircleGridShaderMaterial.InstanceShaderMaterial();

        useDispatchSignal("instantiateShaderMaterial", CircleGridShaderMaterial);

        return CircleGridShaderMaterial._ShaderMaterial;
    }

    static Update() {
        if (!CircleGridShaderMaterial._ShaderMaterial) return;

        CircleGridShaderMaterial._ShaderMaterial.uniforms.uTime.value += .01
    }

    static UpdatePreview(previewMaterial: ShaderMaterial) {
        previewMaterial.uniforms.uTime.value += .01
    }
}

// export class  CircleGridShaderMaterial {
//     static Instance: CircleGridShaderMaterial | null = null;
//     shaderMaterial: ShaderMaterial | undefined;
//     name = "CircleGridShaderMaterial";
//
//     constructor(reuse = true) {
//         if(reuse && CircleGridShaderMaterial.Instance){
//             return CircleGridShaderMaterial.Instance;
//         }
//
//         this.shaderMaterial = new ShaderMaterial({
//             uniforms: {
//                 uTime: {value: 1.0},
//             },
//             vertexShader: vertex,
//             fragmentShader: fragment,
//             side: DoubleSide,
//             transparent: true,
//         });
//
//         useDispatchSignal("instantiateShaderMaterial",this)
//     }
//
//     update() {
//         (this.shaderMaterial as ShaderMaterial).uniforms.uTime.value += .0001
//     }
// }


