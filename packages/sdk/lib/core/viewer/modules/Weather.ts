/*
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2024/12/23 19:27
 * @description 天气系统
 */
import * as THREE from "three";
import { useAddSignal, useRemoveSignal } from "#/hooks";
import Rain from "#/core/objects/weather/Rain";
import Snow from "#/core/objects/weather/Snow";
import { SnowingShaderMaterial } from "#/core/shaderMaterial/modules/SnowingShaderMaterial";
import Viewer from "../Viewer";
import App from "#/core/app/App";

let _fogConfigChangeFn: any = null;
let _rainConfigChangeFn: any = null;
let _snowConfigChangeFn: any = null;
let _objectAddedFn: any = null;

export class Weather {
    private viewer: Viewer;
    rain: Rain | null = null;
    snow: Snow | null = null;
    snowingMaterialObj: THREE.Mesh[] = [];

    constructor(viewer: Viewer) {
        this.viewer = viewer;

        _fogConfigChangeFn = this.sceneFogSettingsChanged.bind(this)
        useAddSignal("sceneFogSettingsChanged", _fogConfigChangeFn);

        _rainConfigChangeFn = this.sceneRainSettingsChanged.bind(this);
        useAddSignal("sceneRainSettingsChanged", _rainConfigChangeFn);

        _snowConfigChangeFn = this.sceneSnowSettingsChanged.bind(this);
        useAddSignal("sceneSnowSettingsChanged", _snowConfigChangeFn);

        _objectAddedFn = this.objectAdded.bind(this);
        useAddSignal("objectAdded", _objectAddedFn);
    }

    objectAdded(object) {
        const { enabled, accumulation } = App.project.getKey("weather.snow");

        if (enabled && accumulation) {
            object.traverseByCondition((obj) => {
                this.replaceSnowMaterial(obj);
            }, (child) => !child.ignore && child.visible);
        }
    }

    /**
     * 场景雾效设置项变更
     */
    sceneFogSettingsChanged() {
        const fog = App.project.getKey("weather.fog")
        if (!fog.enabled) {
            this.viewer.scene.fog = null;
            this.viewer.render();
            return;
        }

        switch (fog.type) {
            case 'Fog':
                if (!(this.viewer.scene.fog instanceof THREE.Fog)) {
                    this.viewer.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
                } else {
                    const _fog = this.viewer.scene.fog as THREE.Fog;
                    _fog.color = new THREE.Color(fog.color);
                    _fog.near = fog.near;
                    _fog.far = fog.far;
                }
                break;
            case 'FogExp2':
                if (!(this.viewer.scene.fog instanceof THREE.FogExp2)) {
                    this.viewer.scene.fog = new THREE.FogExp2(fog.color, fog.density);
                } else {
                    const _fog = this.viewer.scene.fog as THREE.FogExp2
                    _fog.color = new THREE.Color(fog.color);
                    _fog.density = fog.density;
                }
                break;
        }
        this.viewer.render();
    }

    /**
     * 场景雨效设置项变更
     */
    sceneRainSettingsChanged() {
        const { enabled, speed, color, size, radian, alpha } = App.project.getKey("weather.rain");

        if (enabled) {
            if (this.rain) {
                this.rain.updateOptions({
                    speed,
                    color,
                    size,
                    radian,
                    alpha
                })
            } else {
                this.rain = new Rain({
                    speed: speed,
                    color: color,
                    size: size,
                    radian: radian,
                    alpha: alpha
                }, this.viewer.modules.controls);

                this.rain.mesh.ignore = true;
                this.viewer.scene.add(this.rain.mesh as THREE.Object3D);
            }
        } else {
            if (!this.rain) return;

            this.rain.dispose();
            this.rain = null;

            this.viewer.render();
        }
    }

    /**
     * 替换材质贴图增加雪堆积
     */
    replaceSnowMaterial(obj) {
        if (!obj.material) return;

        if (obj.material.map && obj.material.map instanceof THREE.Texture) {
            // 存储原材质
            !obj.metaData && (obj.metaData = {});
            obj.metaData.material = obj.material;

            obj.material = SnowingShaderMaterial.InstanceShaderMaterial().clone();
            obj.material.copyAttr(obj.metaData.material);
            obj.material.transparent = obj.metaData.material.transparent;
            obj.material.uniforms.uTime.value = 0.01;
            obj.material.uniforms.uHasTexture.value = 1.0;
            obj.material.uniforms.uTexture.value = obj.metaData.material.map;
            obj.material.needsUpdate = true;

            this.snowingMaterialObj.push(obj);
        } else if (obj.material.color) {
            // 存储原材质
            !obj.metaData && (obj.metaData = {});
            obj.metaData.material = obj.material;

            const alpha = obj.material.transparent ? obj.material.opacity : 1;
            const color = new THREE.Vector4(obj.material.color.r, obj.material.color.g, obj.material.color.b, alpha);

            obj.material = SnowingShaderMaterial.InstanceShaderMaterial().clone();
            obj.material.copyAttr(obj.metaData.material);
            obj.material.transparent = obj.metaData.material.transparent;
            obj.material.uniforms.uTime.value = 0.01;
            obj.material.uniforms.uHasTexture.value = 0.0;
            obj.material.uniforms.uColor.value = color;
            obj.material.needsUpdate = true;

            this.snowingMaterialObj.push(obj);
        }
    }

    /**
     * 初始化替换材质贴图增加雪堆积
     */
    initSnowMap() {
        this.snowingMaterialObj = [];

        this.viewer.scene.traverseByCondition((obj) => {
            this.replaceSnowMaterial(obj);
        }, (child) => !child.ignore && child.visible);
    }

    /**
     * 关闭雪，还原贴图
     */
    removeSnowMap() {
        for (let i = this.snowingMaterialObj.length - 1; i >= 0; i--) {
            const obj = this.snowingMaterialObj[i];

            // 释放 ShaderMaterial
            // TODO: 20250519: R176版本调用报错，暂不销毁
            // (<THREE.ShaderMaterial>obj.material).dispose();

            // 恢复原始材质
            obj.material = obj.metaData.material as THREE.Material;

            // 清除 metaData 中的材质引用
            // @ts-ignore
            obj.metaData.material = null;
            delete obj.metaData.material;

            // 从数组中删除当前元素
            this.snowingMaterialObj.splice(i, 1);
        }

        this.snowingMaterialObj = [];
    }

    /**
     * 场景雪效设置项变更
     */
    sceneSnowSettingsChanged() {
        const { enabled, speed, size, density, alpha, accumulation } = App.project.getKey("weather.snow");

        if (enabled) {
            if (this.snow) {
                this.snow.updateOptions({
                    speed,
                    size,
                    density,
                    alpha
                })

                if (accumulation && this.snowingMaterialObj.length === 0) {
                    this.initSnowMap()
                } else if (!accumulation && this.snowingMaterialObj.length > 0) {
                    this.removeSnowMap();
                }
            } else {
                this.snow = new Snow({
                    speed: speed,
                    size: size,
                    density: density,
                    alpha: alpha
                }, this.viewer.modules.controls);

                this.snow.mesh.ignore = true;
                this.viewer.scene.add(this.snow.mesh as THREE.Object3D);

                accumulation && this.initSnowMap();
            }
        } else {
            if (!this.snow) return;

            this.snow.dispose();
            this.snow = null;

            this.removeSnowMap();

            this.viewer.render();
        }
    }

    /**
     * 更新天气效果
     * @param deltaTime
     * @return {boolean} 是否需要调用viewport.render()
     */
    update(deltaTime) {
        let needRender = false;

        if (this.rain) {
            this.rain.update(deltaTime);

            needRender = true;
        }

        if (this.snow) {
            this.snow.update(deltaTime);

            if (App.project.getKey("weather.snow.accumulation")) {
                const speed = this.snow.options.speed;
                this.snowingMaterialObj.forEach(obj => {
                    const m = obj.material as THREE.ShaderMaterial;

                    if (m.uniforms.uTime.value > speed / 2) {
                        m.uniforms.uTime.value = speed / 2;
                        return;
                    }

                    m.uniforms.uTime.value += 0.001 * speed;
                });
            }

            needRender = true;
        }

        return needRender;
    }

    dispose() {
        useRemoveSignal("sceneFogSettingsChanged", _fogConfigChangeFn);
        _fogConfigChangeFn = null;
        useRemoveSignal("sceneRainSettingsChanged", _rainConfigChangeFn);
        _rainConfigChangeFn = null;
        useRemoveSignal("sceneSnowSettingsChanged", _snowConfigChangeFn);
        _snowConfigChangeFn = null;

        this.rain && this.rain.dispose();
        this.snow && this.snow.dispose();
    }
}