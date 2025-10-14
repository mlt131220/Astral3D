import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { Effect } from "./Effect";
import { useAddSignal } from "#/hooks";
import Viewer from "../Viewer";
import App from "#/core/app/App";
import { focusObject } from "#/utils/scene/controls.ts";

export class Signals {
    private readonly viewer: Viewer;

    private useBackgroundAsEnvironment = false;

    constructor(viewer: Viewer) {
        this.viewer = viewer;

        this.init();
    }

    init() {
        useAddSignal("sceneCleared", this.sceneCleared.bind(this));
        useAddSignal("transformModeChanged", this.transformModeChanged.bind(this));
        useAddSignal("snapChanged", this.snapChanged.bind(this));
        useAddSignal("spaceChanged", this.spaceChanged.bind(this));
        useAddSignal("effectEnabledChange", this.effectEnabledChange.bind(this));

        useAddSignal("rendererUpdated", this.rendererUpdated.bind(this));
        useAddSignal("rendererCreated", this.rendererCreated.bind(this));
        useAddSignal("rendererConfigUpdate", this.rendererConfigUpdate.bind(this));
        useAddSignal("rendererDetectKTX2Support", this.rendererDetectKTX2Support.bind(this));

        useAddSignal("sceneBackgroundChanged", this.sceneBackgroundChanged.bind(this));
        useAddSignal("sceneEnvironmentChanged", this.sceneEnvironmentChanged.bind(this));
        useAddSignal("sceneGraphChanged", this.sceneGraphChanged.bind(this));
        useAddSignal("cameraChanged", this.cameraChanged.bind(this));
        useAddSignal("cameraReset", this.viewer.updateAspectRatio.bind(this.viewer));
        useAddSignal("viewportCameraChanged", this.viewportCameraChanged.bind(this));
        useAddSignal("viewportShadingChanged", this.viewportShadingChanged.bind(this));

        useAddSignal("objectSelected", this.objectSelected.bind(this));
        useAddSignal("objectFocused", this.objectFocused.bind(this));
        useAddSignal("objectAdded", this.objectAdded.bind(this));
        useAddSignal("objectChanged", this.objectChanged.bind(this));
        useAddSignal("objectRemoved", this.objectRemoved.bind(this));

        useAddSignal("geometryChanged", this.geometryChanged.bind(this));
        useAddSignal("materialChanged", this.materialChanged.bind(this));

        useAddSignal("sceneResize", this.sceneResize.bind(this));
        useAddSignal("showGridChanged", this.showGridChanged.bind(this));
        useAddSignal("showHelpersChanged", this.showHelpersChanged.bind(this));

        useAddSignal("scriptAdded", this.scriptAdded.bind(this));
        useAddSignal("scriptRemoved", this.scriptRemoved.bind(this));
        useAddSignal("scriptChanged", this.scriptChanged.bind(this));
    }

    /**
     * 判断对象是否是可射线选中的
     */
    objectIsCanPick(object: THREE.Object3D | null) {
        return object !== null && object !== this.viewer.scene && object !== this.viewer.camera;
    }

    /**
     * 清空
     */
    sceneCleared() {
        this.viewer.modules.controls.setTarget(0, 0, 0, true);
        this.viewer.pathtracer?.reset();

        this.viewer.css2DRenderer.domElement.innerHTML = "";
        this.viewer.css3DRenderer.domElement.innerHTML = "";

        const rendererConfig = App.project.getKey("renderer");
        App.FPS = rendererConfig.fps;
        this.viewer.renderer.shadowMap.enabled = rendererConfig.shadow.enabled;
        this.viewer.renderer.shadowMap.type = rendererConfig.shadow.type;
        this.viewer.renderer.toneMapping = rendererConfig.toneMapping;
        this.viewer.renderer.toneMappingExposure = rendererConfig.toneMappingExposure

        if (this.viewer.options.hdr) {
            this.viewer.loadEnv(true);
        }

        this.viewer.initPT();
        this.viewer.render();
    }

    /**
     * 模型变换控制器模式改变
     * @param mode
     */
    transformModeChanged(mode) {
        this.viewer.modules.transformControls?.setMode(mode);
    }

    /**
     * 模型变换控制器吸附距离改变
     * @param dist
     */
    snapChanged(dist: number) {
        this.viewer.modules.transformControls?.setTranslationSnap(dist);
    }

    /**
     * 模型变换控制器坐标系改变
     * @param space
     */
    spaceChanged(space: "world" | "local") {
        this.viewer.modules.transformControls?.setSpace(space);
    }

    /**
     * 启用/禁用后处理
     */
    effectEnabledChange(enabled: boolean) {
        if (enabled) {
            this.viewer.selectionBox.visible = false;

            if (this.objectIsCanPick(App.selected) && this.viewer.modules.effect.outlinePass) {
                this.viewer.modules.effect.outlinePass.selectedObjects = [App.selected as THREE.Object3D];
            }
        } else {
            if (this.viewer.modules.effect.outlinePass) {
                this.viewer.modules.effect.outlinePass.selectedObjects = [];
            }

            if (this.objectIsCanPick(App.selected)) {
                this.viewer.box.setFromObject(App.selected as THREE.Object3D, true);
                if (!this.viewer.box.isEmpty()) {
                    this.viewer.selectionBox.visible = true;
                }
            }
        }

        this.render();
    }

    /**
     * 渲染器更新
     */
    rendererUpdated() {
        this.viewer.scene.traverse(function (child) {
            if (child.material !== undefined) {
                (<THREE.Material>child.material).needsUpdate = true;
            }
        });
        this.viewer.render();
    }

    /**
     * 渲染器创建完成后调用
     * @param newRenderer
     */
    rendererCreated(newRenderer: THREE.WebGLRenderer) {
        this.viewer.engineCreated(newRenderer);
    }

    rendererConfigUpdate() {
        this.viewer.createEngine();
    }

    rendererDetectKTX2Support(ktx2Loader) {
        ktx2Loader.detectSupport(this.viewer.renderer);
    }

    /**
     * 场景背景变更
     * @param backgroundType
     * @param backgroundColor
     * @param backgroundTexture
     * @param backgroundEquirectangularTexture
     * @param backgroundBlurriness
     * @param backgroundIntensity
     * @param backgroundRotation
     */
    sceneBackgroundChanged(backgroundType: "" | "Color" | "Texture" | "Equirectangular", backgroundColor: string, backgroundTexture, backgroundEquirectangularTexture, backgroundBlurriness: number, backgroundIntensity: number, backgroundRotation: number) {
        this.viewer.scene.background = null;

        switch (backgroundType) {
            case 'Color':
                this.viewer.scene.background = new THREE.Color(backgroundColor);
                break;
            case 'Texture':
                if (backgroundTexture) {
                    this.viewer.scene.background = backgroundTexture;
                }
                break;
            case 'Equirectangular':
                if (backgroundEquirectangularTexture) {
                    backgroundEquirectangularTexture.mapping = THREE.EquirectangularReflectionMapping;

                    this.viewer.scene.background = backgroundEquirectangularTexture;
                    this.viewer.scene.backgroundBlurriness = backgroundBlurriness;
                    this.viewer.scene.backgroundIntensity = backgroundIntensity;
                    this.viewer.scene.backgroundRotation.y = backgroundRotation * THREE.MathUtils.DEG2RAD;

                    if (this.useBackgroundAsEnvironment) {
                        this.viewer.scene.environment = this.viewer.scene.background as THREE.Texture;
                        this.viewer.scene.environmentRotation.y = backgroundRotation * THREE.MathUtils.DEG2RAD;
                    }
                }
                break;
        }

        this.viewer.dispatchEvent({ type: "onSceneBackgroundChange", backgroundType: backgroundType, background: this.viewer.scene.background })

        this.viewer.updatePTBackground();
        this.render();
    }

    /**
     * 场景环境贴图变更
     * @param environmentType
     * @param environmentEquirectangularTexture
     */
    sceneEnvironmentChanged(environmentType: '' | 'Background' | 'Equirectangular' | 'ModelViewer', environmentEquirectangularTexture: THREE.Texture) {
        this.viewer.scene.environment = null;
        this.useBackgroundAsEnvironment = false;

        switch (environmentType) {
            case 'Background':
                this.useBackgroundAsEnvironment = true;

                this.viewer.scene.environment = this.viewer.scene.background as THREE.Texture;
                this.viewer.scene.environment.mapping = THREE.EquirectangularReflectionMapping;
                this.viewer.scene.environmentRotation.y = this.viewer.scene.backgroundRotation.y;
                break;
            case 'Equirectangular':
                if (environmentEquirectangularTexture) {
                    this.viewer.scene.environment = environmentEquirectangularTexture;
                    this.viewer.scene.environment.mapping = THREE.EquirectangularReflectionMapping;
                }
                break;
            case 'ModelViewer':
                if (!this.viewer.pmremGenerator) {
                    // 创建一个PMREMGenerator，从立方体映射环境纹理生成预过滤的 Mipmap 辐射环境贴图
                    this.viewer.pmremGenerator = new THREE.PMREMGenerator(this.viewer.renderer);
                    this.viewer.pmremGenerator.compileEquirectangularShader();
                }

                this.viewer.scene.environment = this.viewer.pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

                break;
        }

        this.viewer.dispatchEvent({ type: "onSceneEnvironmentChange", environmentType: environmentType, environment: this.viewer.scene.environment })

        this.viewer.updatePTEnvironment();

        this.render();
    }

    /**
     * 手动场景渲染
     */
    sceneGraphChanged() {
        this.viewer.initPT();
        this.render();
    }

    /**
     * 切换主相机
     */
    cameraChanged() {
        this.viewer.pathtracer?.reset();
        this.render();
    }

    /**
     * 场景主相机变更
     */
    viewportCameraChanged() {
        const viewportCamera = App.viewportCamera;
        if (viewportCamera.isPerspectiveCamera || viewportCamera.isOrthographicCamera) {
            this.viewer.updateAspectRatio();
        }

        if (viewportCamera.isPerspectiveCamera) {
            (<THREE.PerspectiveCamera>viewportCamera).aspect = App.camera.aspect;
            viewportCamera.projectionMatrix.copy(App.camera.projectionMatrix);
        } else if (viewportCamera.isOrthographicCamera) {
            // TODO
        }

        // 设置用户Camera时禁用EditorControls
        this.viewer.modules.controls.enabled = (viewportCamera === App.camera);

        // 替换控制器相机
        // this.viewer.modules.controls.camera = viewportCamera;

        this.viewer.initPT();
        this.render();
    }

    /**
     * 场景Shading变更
     * @description 当开启OutlinePass后处理时，设置scene.overrideMaterial无效。
     * @link https://github.com/mrdoob/three.js/issues/30577
     */
    viewportShadingChanged() {
        const viewportShading = App.viewportShading;

        switch (viewportShading) {
            case 'realistic':
                this.viewer.pathtracer?.init(this.viewer.scene, this.viewer.camera);
                break;
            case 'solid':
                this.viewer.scene.overrideMaterial = null;
                break;
            case 'normals':
                this.viewer.scene.overrideMaterial = new THREE.MeshNormalMaterial();
                break;
            case 'wireframe':
                console.log("wireframe")
                this.viewer.scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
                break;
        }

        this.render();
    }

    /**
     * 选中模型
     * @param object
     */
    objectSelected(object) {
        this.viewer.selectionBox.visible = false;

        this.viewer.modules.transformControls?.detach();
        if (this.objectIsCanPick(object)) {
            if (this.viewer.modules.effect.enabled && this.viewer.modules.effect.outlinePass) {
                this.viewer.modules.effect.outlinePass.selectedObjects = [object];
            } else {
                this.viewer.box.setFromObject(object, true);
                if (!this.viewer.box.isEmpty()) {
                    this.viewer.selectionBox.visible = true;
                }
            }
            this.viewer.modules.transformControls?.attach(object);
        }
        this.render();
    }

    /**
     * 聚焦模型
     * @param object
     */
    objectFocused(object) {
        focusObject(object, this.viewer.modules.controls);
    }

    /**
     * 场景新增模型
     */
    objectAdded() {
        this.viewer.computedSceneBox3();
    }

    /**
     * 模型属性变更
     * @param object
     */
    objectChanged(object) {
        if (App.selected === object) {
            this.viewer.box.setFromObject(object, true);

            this.viewer.computedSceneBox3();
        }
        if (object.isPerspectiveCamera) {
            object.updateProjectionMatrix();
        }
        const helper = App.helpers[object.id];
        if (helper !== undefined && !helper.isSkeletonHelper) {
            helper.update();
        }

        this.viewer.initPT();
        this.render();
    }

    /**
     * 模型被移除
     * @param object
     */
    objectRemoved(object) {
        this.viewer.modules.controls.enabled = true;
        if (this.viewer.modules.transformControls && object === this.viewer.modules.transformControls.object) {
            this.viewer.modules.transformControls.detach();
        }

        this.viewer.computedSceneBox3();
    }

    /**
     * geometry 变更
     * @param object
     */
    geometryChanged(object) {
        if (object !== undefined) {
            this.viewer.box.setFromObject(object, true);
        }

        this.viewer.initPT();
        this.render();
    }

    /**
     * material 变更
     */
    materialChanged() {
        this.viewer.updatePTMaterials();
        this.render();
    }

    /**
     * windowResize
     */
    sceneResize() {
        this.viewer.updateAspectRatio();
        this.viewer.renderer?.setSize(this.viewer.container.offsetWidth, this.viewer.container.offsetHeight);
        if (this.viewer.modules.effect.enabled && this.viewer.modules.effect.composer) {
            this.viewer.modules.effect.composer.setSize(this.viewer.container.offsetWidth, this.viewer.container.offsetHeight);
            if (Effect.PassMap.has("FXAA")) {
                const FXAA = Effect.PassMap.get("FXAA") as ShaderPass;
                const pixelRatio = this.viewer.renderer.getPixelRatio();
                FXAA.material.uniforms['resolution'].value.x = 1 / (this.viewer.container.offsetWidth * pixelRatio);
                FXAA.material.uniforms['resolution'].value.y = 1 / (this.viewer.container.offsetHeight * pixelRatio);
            }
        }
        this.viewer.pathtracer?.setSize();

        this.viewer.css3DRenderer.setSize(this.viewer.container.offsetWidth, this.viewer.container.offsetHeight);

        this.viewer.modules.viewHelper.update();

        this.viewer.modules.tilesManage.resize();

        App.csm.updateFrustums();
        this.render();
    }

    /**
     * 是否显示场景网格
     * @param showGrid
     */
    showGridChanged(showGrid: boolean) {
        if (this.viewer.grid) {
            this.viewer.grid.visible = showGrid;
        }

        this.render();
    }

    /**
     * 显示场景辅助线等
     * @param showHelpers
     */
    showHelpersChanged(showHelpers: boolean) {
        this.viewer.showSceneHelpers = showHelpers;
        if (this.viewer.modules.transformControls) {
            this.viewer.modules.transformControls.enabled = showHelpers;
        }

        this.render();
    }

    /**
     * 添加脚本
     */
    scriptAdded(object: THREE.Object3D, _: ISceneScript) {
        this.viewer.installScripts([object.uuid]);
    }

    /**
     * 移除脚本
     */
    scriptRemoved(object: THREE.Object3D, sc: ISceneScript) {
        this.viewer.uninstallScriptsByUuid(object.uuid, sc.name);
    }

    /**
     * 脚本变化
     */
    scriptChanged(attributeName: string, object: THREE.Object3D, sc: ISceneScript) {
        if (attributeName !== "source") return;

        this.viewer.installScripts([object.uuid], sc.name);
    }

    /**
     * 渲染
     */
    render() {
        this.viewer.render();
    }
}