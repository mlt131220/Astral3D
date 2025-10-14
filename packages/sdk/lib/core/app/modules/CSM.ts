import * as THREE from 'three';
import { CSM as _CSM } from 'three/examples/jsm/csm/CSM.js';
import { useDispatchSignal } from '#/hooks';
import App from "#/core/app/App";

// Cascaded Shadow Maps（级联阴影映射，CSM）
class CSM {
    instance: _CSM | null = null;

    constructor(options: IAppProject.CSM) {
        this.enabled = options.enabled;
    }

    get enabled() {
        return !!this.instance;
    }

    set enabled(isEnabled: boolean) {
        if (!isEnabled) {
            if (!this.instance) return;

            // 移除csm创建的对象
            this.instance.remove();
            // 销毁csm插入的shader
            this.instance.dispose();

            this.instance = null;

            useDispatchSignal("sceneGraphChanged");
            return;
        }

        /* 以下是启用csm的逻辑 */
        if (this.instance) {
            this.reset();
            return;
        }

        const _config = App.project.getKey("csm");
        this.instance = new _CSM({
            maxFar: _config.maxFar,
            cascades: 4,
            mode: _config.mode,
            shadowMapSize: _config.shadowMapSize,
            lightDirection: new THREE.Vector3(_config.lightDirectionX, _config.lightDirectionY, _config.lightDirectionZ).normalize(),
            lightIntensity: _config.lightIntensity,
            lightNear: 0.1,
            lightFar: _config.maxFar * 2,
            lightMargin: 200,
            camera: App.viewportCamera,
            parent: App.scene
        });

        this.instance.fade = true;

        this.instance.lights.forEach(light => {
            // 忽略对csm相关object的处理
            light.ignore = true;
            light.target.ignore = true;

            // 设置的灯光颜色
            light.color = new THREE.Color(_config.lightColor);
            light.shadow.bias = -0.00001;
        })

        // 将场景中的全部材质添加到csm
        Object.values(App.materials).forEach(material => {
            this.setupMaterial(material);
        })

        this.instance.updateFrustums();

        useDispatchSignal("sceneGraphChanged");
    }

    reset() {
        if (!this.instance) return;

        this.enabled = false;
        this.enabled = true;
    }

    // 材质添加到csm
    setupMaterial(material: THREE.Material) {
        if (!this.instance) return;

        material.shadowSide = THREE.BackSide;
        this.instance.setupMaterial(material);
    }

    updateProperty(key, value) {
        if (!this.instance) return;

        this.instance[key] = value;

        this.instance.updateFrustums();

        useDispatchSignal("sceneGraphChanged");
    }

    updateLightColor(color: string) {
        if (!this.instance) return;

        this.instance.lights.forEach(light => {
            light.color = new THREE.Color(color);
        })

        useDispatchSignal("sceneGraphChanged");
    }

    updateLightIntensity(intensity: number) {
        if (!this.instance) return;

        this.instance.lightIntensity = intensity;

        this.instance.lights.forEach(light => {
            light.intensity = intensity;
        })

        useDispatchSignal("sceneGraphChanged");
    }

    updateLightDirection(direction: "x" | "y" | "z", value: number) {
        if (!this.instance) return;

        this.instance.lightDirection[direction] = value;

        useDispatchSignal("sceneGraphChanged");
    }

    updateFrustums() {
        if (!this.instance) return;

        this.instance.updateFrustums();

        useDispatchSignal("sceneGraphChanged");
    }

    update() {
        if (!this.instance) return;

        App.viewportCamera.updateMatrixWorld();
        this.instance.update();
    }
}

export { CSM }