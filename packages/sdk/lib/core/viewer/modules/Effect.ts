/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2024/10/26 18:27
 * @description 后处理
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GammaCorrectionShader } from "three/examples/jsm/shaders/GammaCorrectionShader.js";
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import { HalftonePass } from 'three/examples/jsm/postprocessing/HalftonePass.js';
import { LUTPass } from 'three/examples/jsm/postprocessing/LUTPass.js';
import { LUTCubeLoader } from 'three/examples/jsm/loaders/LUTCubeLoader.js';
import { LUT3dlLoader } from 'three/examples/jsm/loaders/LUT3dlLoader.js';
import { LUTImageLoader } from 'three/examples/jsm/loaders/LUTImageLoader.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
// import {OutputPass} from "three/examples/jsm/postprocessing/OutputPass.js";
import { useAddSignal } from "#/hooks";
import Viewer from "../Viewer";
import App from "#/core/app/App";

type supportPass = Pass | OutlinePass | ShaderPass | UnrealBloomPass | BokehPass | RenderPixelatedPass | HalftonePass;

let _passConfigChangeFn: any = null;

export const LUTEffectMap = {
    'Bourbon 64.CUBE': null,
    'Chemical 168.CUBE': null,
    'Clayton 33.CUBE': null,
    'Cubicle 99.CUBE': null,
    'Remy 24.CUBE': null,
    'Presetpro-Cinematic.3dl': null,
    'NeutralLUT.png': null,
    'B&WLUT.png': null,
    'NightLUT.png': null
};

export class Effect {
    private viewer: Viewer;

    composer: EffectComposer | undefined;
    outlinePass: OutlinePass | undefined;

    // 其他可动态配置的通道
    static PassMap = new Map<string, supportPass>();

    constructor(viewer: Viewer) {
        this.viewer = viewer;

        _passConfigChangeFn = this.handlePassConfigChange.bind(this);
        useAddSignal("effectPassConfigChange", _passConfigChangeFn)
    }

    get enabled() {
        return App.project.getKey("effect.enabled");
    }

    createComposer() {
        if (this.composer) {
            this.clear();
        }

        const { composer, outlinePass } = this.initComposer();
        this.composer = composer as EffectComposer;
        this.outlinePass = outlinePass;

        // 加入默认打开的通道
        const effectConfig = App.project.getKey("effect");
        if (effectConfig) {
            Object.keys(effectConfig).forEach(key => {
                if (key === "enabled" || key === "Outline") return;

                // 判断是否存在 enabled 属性
                if (effectConfig[key].hasOwnProperty('enabled') && effectConfig[key].enabled === true) {
                    if (!this[key] || !(this[key] instanceof Pass)) return;

                    this.composer?.addPass(this[key]);
                }
            })
        }
    }

    protected initComposer() {
        if (!this.viewer.renderer) return {};

        const pixelRatio = this.viewer.renderer.getPixelRatio();

        // 创建后处理对象EffectComposer，WebGL渲染器作为参数
        let composer = new EffectComposer(this.viewer.renderer);
        composer.setPixelRatio(pixelRatio);
        composer.setSize(this.viewer.container.offsetWidth, this.viewer.container.offsetHeight);

        // let ssaaRenderPass = new SSAARenderPass(this.viewer.scene, this.viewer.camera);
        // ssaaRenderPass.unbiased = false;
        // ssaaRenderPass.sampleLevel = 2;
        // ssaaRenderPass.clearColor = new THREE.Color("#272727");
        // ssaaRenderPass.clearAlpha = 0;
        // composer.addPass(ssaaRenderPass);

        const renderPass = new RenderPass(this.viewer.scene, this.viewer.camera);
        renderPass.clearColor = new THREE.Color("#272727");
        renderPass.clearAlpha = 0;
        renderPass.clearDepth = true;
        composer.addPass(renderPass);

        const outlineConfig = App.project.getKey("effect.Outline");
        const outlinePass = new OutlinePass(new THREE.Vector2(this.viewer.container.offsetWidth, this.viewer.container.offsetHeight), this.viewer.scene, this.viewer.camera)
        outlinePass.visibleEdgeColor = new THREE.Color(outlineConfig.visibleEdgeColor || "#ffee00");
        outlinePass.hiddenEdgeColor = new THREE.Color(outlineConfig.hiddenEdgeColor || "#ff6a00");
        outlinePass.edgeStrength = outlineConfig.edgeStrength || Number(3.0);
        outlinePass.edgeGlow = outlineConfig.edgeGlow || Number(0.2);
        outlinePass.edgeThickness = outlineConfig.edgeThickness || Number(1.0);
        outlinePass.pulsePeriod = outlineConfig.pulsePeriod || Number(0.0);
        outlinePass.usePatternTexture = outlineConfig.usePatternTexture || false;
        outlinePass.selectedObjects = [];
        composer.addPass(outlinePass);

        // 创建伽马校正通道. 解决gltf模型后处理时，颜色偏差的问题
        const gammaPass = new ShaderPass(GammaCorrectionShader);
        composer.addPass(gammaPass);

        // const outputPass = new OutputPass();
        // composer.addPass(outputPass);

        return { composer, outlinePass };
    }

    /**
     * FXAA 抗锯齿通道
     */
    get FXAA(): ShaderPass | null {
        if (Effect.PassMap.has("FXAA")) {
            return Effect.PassMap.get("FXAA") as ShaderPass;
        }

        if (!this.viewer.renderer) return null;

        const options = App.project.getKey("effect.FXAA");

        const fxaaPass = new ShaderPass(FXAAShader);
        fxaaPass.clear = true;
        const pixelRatio = this.viewer.renderer.getPixelRatio();
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (this.viewer.container.offsetWidth * pixelRatio);
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (this.viewer.container.offsetHeight * pixelRatio);
        fxaaPass.enabled = options.enabled || false;

        Effect.PassMap.set("FXAA", fxaaPass);

        return fxaaPass;
    }

    /**
     * UnrealBloom 仿UE辉光
     */
    get UnrealBloom(): UnrealBloomPass {
        if (Effect.PassMap.has("UnrealBloom")) {
            return Effect.PassMap.get("UnrealBloom") as UnrealBloomPass;
        }

        const options = App.project.getKey("effect.UnrealBloom");

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(this.viewer.container.offsetWidth, this.viewer.container.offsetWidth), 1, 0, 0);
        bloomPass.threshold = options.threshold || 0;
        bloomPass.strength = options.strength === undefined ? 1 : options.strength;
        bloomPass.radius = options.radius || 0;

        Effect.PassMap.set("UnrealBloom", bloomPass);

        return bloomPass;
    }

    /**
     * Bokeh 变焦,背景虚化（焦外成像）
     */
    get Bokeh(): BokehPass {
        if (Effect.PassMap.has("Bokeh")) {
            return Effect.PassMap.get("Bokeh") as BokehPass;
        }

        const options = App.project.getKey("effect.Bokeh");

        const bokehPass = new BokehPass(this.viewer.scene, App.viewportCamera, {
            focus: options.focus,
            aperture: options.aperture,
            maxblur: options.maxblur
        });

        Effect.PassMap.set("Bokeh", bokehPass);

        return bokehPass;
    }

    /**
     * Pixelate 像素风
     * @description 渲染时会受场景背景影响，纯色背景才有最佳渲染效果
     */
    get Pixelate(): RenderPixelatedPass {
        if (Effect.PassMap.has("Pixelate")) {
            return Effect.PassMap.get("Pixelate") as RenderPixelatedPass;
        }

        const options = App.project.getKey("effect.Pixelate");

        const pixelatedPass = new RenderPixelatedPass(options.pixelSize || 6, this.viewer.scene, App.viewportCamera, {
            normalEdgeStrength: options.normalEdgeStrength,
            depthEdgeStrength: options.depthEdgeStrength
        });

        Effect.PassMap.set("Pixelate", pixelatedPass);

        return pixelatedPass;
    }

    /**
     * Halftone 半色调
     */
    get Halftone(): HalftonePass {
        if (Effect.PassMap.has("Halftone")) {
            return Effect.PassMap.get("Halftone") as HalftonePass;
        }

        const options = App.project.getKey("effect.Halftone");

        const halftonePass = new HalftonePass(options);

        Effect.PassMap.set("Halftone", halftonePass);

        return halftonePass;
    }

    /**
     * LUT 颜色滤镜
     */
    get LUT(): LUTPass {
        if (Effect.PassMap.has("LUT")) {
            return Effect.PassMap.get("LUT") as LUTPass;
        }

        const options = App.project.getKey("effect.LUT");

        const _LUTCubeLoader = new LUTCubeLoader();
        const _LUTImageLoader = new LUTImageLoader();
        const _LUT3dlLoader = new LUT3dlLoader();

        // 优先加载配置项的lut
        if (!LUTEffectMap[options.lut]) {
            const lutUrl = new URL(`${import.meta.env.BASE_URL}resource/luts/${options.lut}`, import.meta.url).href;

            if (/\.CUBE$/i.test(options.lut)) {
                _LUTCubeLoader.load(lutUrl, (result) => {
                    LUTEffectMap[options.lut] = result;

                    this.viewer.render();
                });
            } else if (/\.png$/i.test(options.lut)) {
                _LUTImageLoader.load(lutUrl, (result) => {
                    LUTEffectMap[options.lut] = result;

                    this.viewer.render();
                });
            } else {
                _LUT3dlLoader.load(lutUrl, (result) => {
                    LUTEffectMap[options.lut] = result;

                    this.viewer.render();
                });
            }
        }

        Object.keys(LUTEffectMap).forEach(name => {
            if (LUTEffectMap[name]) return;

            const lutUrl = new URL(`${import.meta.env.BASE_URL}resource/luts/${name}`, import.meta.url).href;

            if (/\.CUBE$/i.test(name)) {
                _LUTCubeLoader.load(lutUrl, function (result) {
                    LUTEffectMap[name] = result;
                });
            } else if (/\.png$/i.test(name)) {
                _LUTImageLoader.load(lutUrl, function (result) {
                    LUTEffectMap[name] = result;
                });
            } else {
                _LUT3dlLoader.load(lutUrl, function (result) {
                    LUTEffectMap[name] = result;
                });
            }
        });

        const lutPass = new LUTPass({
            intensity: options.intensity
        });

        Effect.PassMap.set("LUT", lutPass);

        return lutPass;
    }

    /**
     * 运动残影
     */
    get Afterimage(): AfterimagePass {
        if (Effect.PassMap.has("Afterimage")) {
            return Effect.PassMap.get("Afterimage") as AfterimagePass;
        }

        const options = App.project.getKey("effect.Afterimage");

        const afterimagePass = new AfterimagePass(options.damp);

        Effect.PassMap.set("Afterimage", afterimagePass);

        return afterimagePass;
    }

    /**
     * 通道配置变更
     * @param name 通道名
     * @param config 新配置
     */
    handlePassConfigChange(name: string, config) {
        // App.project.setKey(`effect.${name}`, config);

        if (name === "Outline") {
            if (this.outlinePass) {
                for (const key in config) {
                    (<OutlinePass>this.outlinePass)[key] = this.getPassConfigValue(key, config[key]);
                }
            }
        } else {
            if (!config.enabled) {
                if (Effect.PassMap.has(name)) {
                    this.composer?.removePass(Effect.PassMap.get(name) as Pass)
                    Effect.PassMap.delete(name);

                    this.viewer.render();
                }

                return;
            }

            if (!Effect.PassMap.has(name)) {
                if (!this[name] || !(this[name] instanceof Pass)) return;

                // get this[name]时创建的Pass会自动加入到Effect.PassMap
                this.composer?.addPass(this[name]);

                this.viewer.render();

                return;
            }

            if (!this[name]) return;

            switch (name) {
                // 参数配置在uniforms的Pass
                case "Bokeh":
                case 'Halftone':
                case 'Afterimage':
                    for (const key in config) {
                        if (this[name].uniforms[key] === undefined) {
                            this[name][key] = this.getPassConfigValue(key, config[key]);
                            continue;
                        }

                        this[name].uniforms[key].value = this.getPassConfigValue(key, config[key]);
                    }
                    break;
                case "Pixelate":
                    for (const key in config) {
                        if (key === "pixelSize") {
                            this.Pixelate.setPixelSize(config[key]);
                        } else {
                            this.Pixelate[key] = this.getPassConfigValue(key, config[key]);
                        }
                    }
                    break;
                case "LUT":
                    for (const key in config) {
                        if (key === "lut") {
                            const lut = LUTEffectMap[config[key]];

                            Boolean(lut) && (this.LUT.lut = lut.texture3D);
                        } else {
                            this.LUT[key] = this.getPassConfigValue(key, config[key]);
                        }
                    }
                    break;
                default:
                    for (const key in config) {
                        this[name][key] = this.getPassConfigValue(key, config[key]);
                    }
                    break;
            }
        }

        this.viewer.render();
    }

    /**
     * 处理通道值
     */
    getPassConfigValue(key: string, value: any) {
        if (["visibleEdgeColor", "hiddenEdgeColor"].includes(key)) {
            return new THREE.Color(value);
        }

        if (["rotateR", "rotateG", "rotateB"].includes(key)) {
            return value * (Math.PI / 180);
        }

        return value;
    }

    render(deltaTime: number) {
        if (!this.enabled || !this.composer) return;

        // PassMap中存在 LUT 则说明 LUT 是启用的
        // lutMap是异步加载的，所以此处做判断
        if (Effect.PassMap.has("LUT")) {
            const lut = LUTEffectMap[App.project.getKey("effect.LUT.lut")];
            this.LUT.enabled = Boolean(lut);
            if (this.LUT.enabled) {
                this.LUT.lut = lut.texture3D;
            }
        }

        this.composer.render(deltaTime);
    }

    clear() {
        if (this.composer) {
            for (let i = this.composer.passes.length; i > 0; i--) {
                this.composer.passes[i - 1].dispose && this.composer.passes[i - 1].dispose();
                this.composer.removePass(this.composer.passes[i - 1]);
            }

            this.composer.dispose();
        }
    }

    dispose() {
        this.clear();

        _passConfigChangeFn = null;
    }
}