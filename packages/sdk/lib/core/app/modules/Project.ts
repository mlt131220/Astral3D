/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2025/4/26 13:59
 * @description 当前项目相关信息
 */
import * as THREE from 'three';
import { getNestedProperty } from "#/utils";
import type { App } from "../App";
import { useRemoveSignal, useAddSignal, useDispatchSignal } from '#/hooks';
import { FPS_OPTIONS } from "#/constant";

export const defaultProjectInfo = (): IAppProject.Info => ({
    // 项目运行是否启用xr
    xr: false,
    // 渲染器相关配置
    renderer: {
        // 渲染帧率上限,默认60
        fps: FPS_OPTIONS.HIGH,
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1,
        shadow: {
            enabled: true,
            type: THREE.PCFSoftShadowMap,
        },
    },
    // 级联阴影映射
    csm: {
        enabled: false,
        fade: false,
        maxFar: 1000,
        mode: "practical",
        shadowMapSize: 2048,
        lightDirectionX: -1,
        lightDirectionY: -1,
        lightDirectionZ: -1,
        lightIntensity: 1,
        lightColor: "#ffffff"
    },
    // 后处理
    effect: {
        enabled: false,
        // 描边线
        Outline: {
            enabled: true,
            // 边缘的强度，值越高边框范围越大
            edgeStrength: Number(3.0),
            // 发光强度
            edgeGlow: Number(0.2),
            // 边缘浓度
            edgeThickness: Number(1.0),
            // 闪烁频率，值越大频率越低
            pulsePeriod: Number(0.0),
            // 禁用纹理以获得纯线的效果
            usePatternTexture: false,
            // 可见边缘的颜色
            visibleEdgeColor: "#ffee00",
            // 不可见边缘的颜色
            hiddenEdgeColor: "#ff6a00"
        },
        // 抗锯齿
        FXAA: {
            enabled: true,
        },
        // 辉光
        UnrealBloom: {
            enabled: false,
            // 光晕阈值，值越小，效果越明显
            threshold: 0,
            // 光晕强度
            strength: 1,
            // 光晕半径
            radius: 0
        },
        // 背景虚化
        Bokeh: {
            enabled: false,
            // 焦距，调整远近，对焦时才会清晰
            focus: 500.0,
            // 孔径，类似相机孔径调节
            aperture: 0.00005,
            // 最大模糊程度
            maxblur: 0.01
        },
        // 像素风
        Pixelate: {
            enabled: false,
            // 像素大小
            pixelSize: 6,
            // 法向边缘强度
            normalEdgeStrength: 0.3,
            // 深度边缘强度
            depthEdgeStrength: 0.4,
        },
        // 半色调
        Halftone: {
            enabled: false,
            // 形状：点，椭圆，线，正方形
            shape: 1,
            // 半径
            radius: 4,
            // R色旋转
            rotateR: Math.PI / 12,
            // G色旋转
            rotateG: Math.PI / 12 * 2,
            // B色旋转
            rotateB: Math.PI / 12 * 3,
            // 分散度
            scatter: 0,
            // 混合度
            blending: 1,
            // 混合模式：线性，相乘，相加，明亮，昏暗
            blendingMode: 1,
            // 灰度
            greyscale: false,
        },
        // LUT颜色滤镜
        LUT: {
            enabled: false,
            lut: 'Bourbon 64.CUBE',
            intensity: 1
        },
        // 运动残影
        Afterimage: {
            enabled: false,
            damp: 0.95
        }
    },
    // 天气
    weather: {
        fog: {
            enabled: false,
            type: "Fog", // Fog, FogExp2
            color: "#ffffff",
            near: 0.10,
            far: 50.0,
            density: 0.05,
        },
        rain: {
            enabled: false,
            speed: 0.4,
            color: "#ffffff",
            size: 0.5,
            radian: 95,
            alpha: 0.4
        },
        snow: {
            enabled: false,
            size: 0.5,
            density: 1.0,
            speed: 1.0,
            alpha: 0.5,
            accumulation: false,
        }
    },
    // 场景信息
    sceneInfo: {
        // 场景id，使用uuid
        id: "",
        // 场景名称
        sceneName: "",
        // 场景分类  城市、园区、工厂、楼宇、设备、其他...
        sceneType: "其他",
        // 场景描述
        sceneIntroduction: "",
        // 场景版本
        sceneVersion: 1,
        // 项目类型。0：Web3D-THREE  1：WebGIS-Cesium
        projectType: 0,
        // 场景封面图
        coverPicture: "",
        // 场景是否包含图纸
        hasDrawing: false,
        // 场景zip包地址
        zip: "",
        // 场景zip包大小
        zipSize: "0",
        // WebGIS-Cesium 类型项目的基础Cesium配置
        cesiumConfig: undefined
    },
    // 图纸
    drawing: {
        // 是否已上传图纸
        isUploaded: false,
        // 图片base64 / cad文件路径
        imgSrc: "",
        // 是否cad
        isCad: false,
        // cad图层信息
        layers: {},
        // 是否正在绘制矩形标记
        isDrawingRect: false,
        // 选中的矩形索引
        selectedRectIndex: -1,
        // 标记列表
        markList: [],
        // 标记图纸时的图纸属性信息
        imgInfo: {
            width: 0,
            height: 0
        }
    }
})

let drawingMarkDoneFn: null | ((type: "add" | "update", rect: IAppProject.DrawingMark) => void) = null;

class Project {
    public app: App
    public info: IAppProject.Info;

    constructor(app: App) {
        this.app = app;

        this.info = defaultProjectInfo();

        drawingMarkDoneFn = this.drawingMarkListChange.bind(this);
        useAddSignal("drawingMarkDone", drawingMarkDoneFn);
    }

    /**
     * 获取配置
     * @param {string} key 可以多层级，需用.分割，如a.b.c
     */
    getKey(key: string): any {
        return getNestedProperty(this.info, key);
    }

    /**
     * 设置配置项,配置变更自动执行相应处理
     * @param {string} key 可以多层级，需用.分割，如a.b.c
     * @param {unknown} value 配置项的值
     * @param {boolean} executeAction 是否自动执行相应处理
     */
    setKey(key: string, value: unknown, executeAction: boolean = true) {
        const keys = key.split(".");

        if (keys.length === 1) {
            this.info[key] = value;
        } else {
            let obj = this.info;
            for (let i = 0; i < keys.length; i++) {
                if (keys.length - i === 1) {
                    obj[keys[i]] = value;
                    break;
                }

                obj = obj[keys[i]];
            }
        }

        /* 执行相应处理 */
        if (!executeAction || ["xr", "sceneInfo", "drawing"].includes(keys[0])) return;

        const secondProperty = keys[1];
        // 如果setKey传入的是第一层级的变更且不是特殊单层处理的属性，则遍历为第二层级递归以执行相应处理
        if (!secondProperty && !["renderer"].includes(key)) {
            const propertyValue = this.info[key];

            Object.keys(propertyValue).forEach(secondKey => {
                this.setKey(`${key}.${secondKey}`, propertyValue[secondKey]);
            })

            return;
        }

        if (key.startsWith("renderer")) {
            if (!this.app.viewer) return;

            if (["renderer.antialias", "renderer"].includes(key)) {
                this.app.viewer.createEngine();
            } else {
                this.app.viewer.renderer.shadowMap.enabled = this.info.renderer.shadow.enabled;
                this.app.viewer.renderer.shadowMap.type = this.info.renderer.shadow.type;
                this.app.viewer.renderer.toneMapping = this.info.renderer.toneMapping;
                this.app.viewer.renderer.toneMappingExposure = this.info.renderer.toneMappingExposure;
                this.app.FPS = this.info.renderer.fps;

                useDispatchSignal("rendererUpdated");
            }
        } else if (key.startsWith("csm")) {
            switch (key) {
                case "csm.enabled":
                    this.app.csm.enabled = this.info.csm.enabled;
                    break;
                case "csm.fade":
                case "csm.maxFar":
                case "csm.mode":
                    this.app.csm.updateProperty(secondProperty, this.info.csm[secondProperty]);
                    break;
                case "csm.shadowMapSize":
                    this.app.csm.reset();
                    break;
                case "csm.lightColor":
                    this.app.csm.updateLightColor(this.info.csm.lightColor);
                    break;
                case "csm.lightIntensity":
                    this.app.csm.updateLightIntensity(this.info.csm.lightIntensity);
                    break;
                case "csm.lightDirectionX":
                    this.app.csm.updateLightDirection('x', this.info.csm.lightDirectionX);
                    break;
                case "csm.lightDirectionY":
                    this.app.csm.updateLightDirection('y', this.info.csm.lightDirectionY);
                    break;
                case "csm.lightDirectionZ":
                    this.app.csm.updateLightDirection('z', this.info.csm.lightDirectionZ);
                    break;
            }
        } else if (key.startsWith("effect")) {
            if (key === "effect.enabled") {
                useDispatchSignal("effectEnabledChange", this.info.effect.enabled);
            } else {
                useDispatchSignal("effectPassConfigChange", secondProperty, this.info.effect[secondProperty]);
            }
        } else if (key.startsWith("weather")) {
            switch (key) {
                case "weather.fog":
                    useDispatchSignal("sceneFogSettingsChanged");
                    break;
                case "weather.rain":
                    useDispatchSignal("sceneRainSettingsChanged");
                    break;
                case "weather.snow":
                    useDispatchSignal("sceneSnowSettingsChanged");
                    break;
            }
        }
    }

    /**
     * 设置图纸src
     */
    setDrawingSrc(src: string) {
        this.info.drawing.isCad = src.split(".").pop() === "dxf";
        this.info.drawing.imgSrc = src;
    }

    /**
     * 设置图纸图层显示隐藏
     * @param layerName
     * @param visible
     */
    setDrawingLayerVisible(layerName: string, visible: boolean) {
        this.info.drawing.layers[layerName].visible = visible;
    }

    /**
     * 设置图纸所有图层显示隐藏
     * @param visible
     */
    setDrawingLayerAllVisible(visible: boolean) {
        for (let key in this.info.drawing.layers) {
            this.info.drawing.layers[key].visible = visible;
        }
    }

    /**
     * 图纸标记变更
     * @param type
     * @param rect
     */
    drawingMarkListChange(type: "add" | "update", rect: IAppProject.DrawingMark) {
        switch (type) {
            case "add":
                this.info.drawing.markList.push(rect);
                break;
            case "update":
                const index = this.info.drawing.markList.findIndex(item => item.modelUuid === rect.modelUuid);
                if (index !== -1) {
                    this.info.drawing.markList[index] = rect;
                }
                break;
        }
    }

    /**
     * 重置图纸配置,一般用于清除图纸状态
     */
    resetDrawing() {
        this.info.drawing = defaultProjectInfo().drawing;
    }

    // /**
    //  * 清空所有项目配置
    //  */
    // clear(){
    //     const sceneInfo = {...this.info.sceneInfo};
    //
    //     this.info = defaultProjectInfo();
    //
    //     this.info.sceneInfo = sceneInfo;
    // }

    dispose() {
        if (drawingMarkDoneFn) {
            useRemoveSignal("drawingMarkDone", drawingMarkDoneFn);
            drawingMarkDoneFn = null;
        }
    }
}

export { Project };