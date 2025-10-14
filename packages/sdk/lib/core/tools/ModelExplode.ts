/**
 * 模型爆炸展开
 */
import * as THREE from 'three';
import { useDispatchSignal } from "#/hooks";

interface IModelExplodeData {
    // 爆炸方向
    worldDir: THREE.Vector3;
    // 爆炸距离：mesh中心点到爆炸中心的距离
    worldDistance: THREE.Vector3;
    // 原始坐标
    originPosition: THREE.Vector3;
    // mesh中心
    meshCenter: THREE.Vector3;
    // 爆炸中心
    explodeCenter: THREE.Vector3;
}

class ModelExplode {
    // 模型爆炸的展开数据
    meshExplodeData = new Map<string, Map<string, IModelExplodeData>>();

    // 已执行模型爆炸未还原的模型
    unrestoredModel: THREE.Object3D[] = [];

    constructor() {
    }

    /**
     * 计算模型爆炸的展开数据
     */
    computedExplodeData(model: THREE.Object3D): void {
        if (!model) return;

        // 计算模型中心
        const modelBox = new THREE.Box3();
        modelBox.setFromObject(model);
        const explodeCenter = this.getWorldCenterPosition(modelBox);

        const meshBox = new THREE.Box3();

        const dataMap: Map<string, IModelExplodeData> = new Map();
        model.traverse((child) => {
            if (!child || !child.isMesh || child.isLine || child.isSprite) return;

            meshBox.setFromObject(child);
            const meshCenter = this.getWorldCenterPosition(meshBox);
            const worldDistance = new THREE.Vector3().subVectors(meshCenter, explodeCenter)
            const meshExplodeData: IModelExplodeData = {
                worldDir: worldDistance.clone().normalize(),
                worldDistance: worldDistance,
                originPosition: child.getWorldPosition(new THREE.Vector3()),
                meshCenter: meshCenter.clone(),
                explodeCenter: explodeCenter.clone(),
            }

            dataMap.set(child.uuid, meshExplodeData);
        })

        this.meshExplodeData.set(model.uuid, dataMap);
    }

    getWorldCenterPosition(box: THREE.Box3, scalar = 0.5) {
        return new THREE.Vector3().addVectors(box.max, box.min).multiplyScalar(scalar);
    }

    explodeModel(model: THREE.Object3D, scalar: number = 0.5) {
        if (!this.meshExplodeData.has(model.uuid)) {
            this.computedExplodeData(model);
        }

        const dataMap = this.meshExplodeData.get(model.uuid);
        if (!dataMap) return;

        model.traverse((child) => {
            if (!dataMap.has(child.uuid)) return;

            const data = dataMap.get(child.uuid);
            if (!data) return;

            const distance = data.worldDir.clone().multiplyScalar(data.worldDistance.length() * scalar);
            const offset = new THREE.Vector3().subVectors(data.meshCenter, data.originPosition);
            const center = data.explodeCenter;
            const newPosition = new THREE.Vector3().copy(center).add(distance).sub(offset);
            const localPosition = child.parent?.worldToLocal(newPosition);

            if (localPosition) {
                child.position.copy(localPosition);
            }
        })

        useDispatchSignal("sceneGraphChanged");

        this.unrestoredModel.push(model);
    }

    // 还原
    restore() {
        this.unrestoredModel.forEach(model => {
            const dataMap = this.meshExplodeData.get(model.uuid);
            if (!dataMap) return;

            model.traverse((child) => {
                if (!dataMap.has(child.uuid)) return;

                const data = dataMap.get(child.uuid);
                if (!data) return;

                const _originPosition = child.parent?.worldToLocal(data.originPosition);

                if (_originPosition) {
                    child.position.copy(_originPosition);
                }
            })

            useDispatchSignal("sceneGraphChanged");
        })

        this.unrestoredModel = [];

        this.clear();
    }

    clear() {
        this.meshExplodeData.clear();
    }
}

export { ModelExplode };