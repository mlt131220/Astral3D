/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @description 下雪特效着色器
 */
import { ShaderChunk, ShaderMaterial, Vector2, Vector4, TextureLoader, RepeatWrapping, DoubleSide } from "three";
import { useDispatchSignal } from "#/hooks";

const vertex = `
${ShaderChunk.common}
${ShaderChunk.logdepthbuf_pars_vertex}

varying vec2 vUv;
varying vec3 vNormal;

void main () {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    
    ${ShaderChunk.logdepthbuf_vertex}
}`;

const fragment = /*glsl*/`
${ShaderChunk.logdepthbuf_pars_fragment}

varying vec2 vUv;
varying vec3 vNormal;
uniform float uTime;
uniform vec2 uResolution;
uniform float uHasTexture;
uniform vec4 uColor;
uniform sampler2D uTexture;
uniform sampler2D uNoiseMap;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}


float fbm(vec3 uv,float _amp,float _min) {
    float amp = _amp; 
    float f = 0.; 
    for(int x=0;x<3;x++) {
      f+=(snoise(uv.xz)*0.5+0.5)*.25+.75 * amp; 
      amp*=_amp; 
      uv*=2.7; 
    }
    return max(f,_min); 
}

void main(void) {
   vec2 uv = vUv;
   
   float _noise = fbm(vec3(uv.x*100.,0.0,uv.y*100.),0.47,0.2); // 噪声
   
   vec3 norm = vec3(0.0,1.0,0.0); 
    vec3 normalDistribution = vec3(1.0/_noise,_noise,1.0-_noise); 
    normalDistribution=normalDistribution*2.-1.; 
    vec3 newnorm = norm * normalDistribution; 
    newnorm = dot(newnorm,norm) < 0.0 ? -newnorm : newnorm; 
    
    vec3 color = mix(vec3(_noise),vec3(0.529411765,0.8,1.0)*vec3(_noise),1.0-dot(newnorm,vec3(0.0,1.0,0.0))); 
    
    // 面法线与Y轴的角度进行点乘
    vec4 yAxis = normalize(viewMatrix * vec4(0.0, 1.0, 0.0, 0.0));
    // 法线与y轴垂直时点积为0,snowThickness为0
    float snowThickness = smoothstep(0.5, 1.0, abs(dot(vNormal, yAxis.xyz)));
    
    if(uHasTexture > 0.5) {
      gl_FragColor = texture2D(uTexture,uv);
     } else {
      gl_FragColor = uColor;
     }
    
    // snowScale 雪覆盖区域大小
    // snowThickness *= 1.0 - clamp(texture2D(uNoiseMap, uv).r, 0.0, 1.0 - snowScale);
    snowThickness *= 1.0 - clamp(texture2D(uNoiseMap, uv).r, 0.0, 1.0 - 0.8);
    vec4 noiseColor = snowThickness * uTime * vec4(1.0, 1.0, 1.0, 1.0);
    
    if(snowThickness > 0.1) {
      gl_FragColor = mix(noiseColor,gl_FragColor,clamp(fbm(vec3(uv.x*10.,0.0,uv.y*10.)*.5+.5,0.47,0.0)-sin(uTime*.5),0.0,1.0));
    }else{
      gl_FragColor += noiseColor; 
    }
    
    ${ShaderChunk.logdepthbuf_fragment}
}`;

export class SnowingShaderMaterial {
    static _ShaderMaterial: ShaderMaterial;
    static Name = "SnowingShaderMaterial";

    static get Material() {
        if (!SnowingShaderMaterial._ShaderMaterial) {
            SnowingShaderMaterial.Init();
        }
        return SnowingShaderMaterial._ShaderMaterial;
    }

    static set Material(value) {
        SnowingShaderMaterial._ShaderMaterial = value;
    }

    static get PreviewMaterial() {
        return SnowingShaderMaterial.InstanceShaderMaterial();
    }

    static get Resolution() {
        return new Vector2(window.innerWidth, window.innerHeight);
    }

    static set Resolution(value) {
        SnowingShaderMaterial._ShaderMaterial.uniforms.uResolution.value.set(value.x, value.y);
    }

    static InstanceShaderMaterial() {
        const textureLoader = new TextureLoader();

        const material = new ShaderMaterial({
            uniforms: {
                uTime: { value: 0.1 },
                uResolution: { value: SnowingShaderMaterial.Resolution },
                uNoiseMap: { value: null },
                uTexture: { value: null },
                uHasTexture: { value: 0.0 },
                uColor: { value: new Vector4(1.0, 1.0, 1.0, 1.0) }
            },
            vertexShader: vertex,
            fragmentShader: fragment,
            side: DoubleSide,
            transparent: false,
            depthTest: true,
            depthWrite: true,
            lights: false
        });
        material.name = SnowingShaderMaterial.Name;

        textureLoader.load(new URL(import.meta.env.BASE_URL + 'resource/textures/noise.png', import.meta.url).href, (texture) => {
            texture.wrapS = texture.wrapT = RepeatWrapping;
            texture.repeat.set(1, 1);
            material.uniforms.uNoiseMap.value = texture;
        });

        return material;
    }

    static Init() {
        SnowingShaderMaterial._ShaderMaterial = SnowingShaderMaterial.InstanceShaderMaterial();

        useDispatchSignal("instantiateShaderMaterial", SnowingShaderMaterial);

        return SnowingShaderMaterial._ShaderMaterial;
    }

    static Update() {
        if (!SnowingShaderMaterial._ShaderMaterial) return;

        SnowingShaderMaterial._ShaderMaterial.uniforms.uTime.value += .01;
    }

    static UpdatePreview(previewMaterial: ShaderMaterial) {
        previewMaterial.uniforms.uTime.value += .01
    }
}

