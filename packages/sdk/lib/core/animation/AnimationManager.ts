import * as THREE from 'three';
import { useDispatchSignal } from '#/hooks';
import { escapeRegExp } from "#/utils";
import App from "#/core/app/App";

let prevActionsInUse = 0, needsUpdate = false;
export class AnimationManager {
    // 场景中的动画混合器集合
    public mixerMap: Map<string, THREE.AnimationMixer> = new Map();
    // 场景中的动画action集合
    public actionMap: Map<string, THREE.AnimationAction> = new Map();

    constructor() { }

    /**
     * 检查动画剪辑上是否已存在当前object的相应轨道,存在则返回该轨道
     * @param clip 动画剪辑
     * @param prop 需要检查的属性名称
     * @param object 需要检查的对象
     */
    hasExistingTrack(clip: THREE.AnimationClip, prop: string, object: THREE.Object3D | null = null) {
        if (!object) {
            object = App.selected;
            if (!object) return false;
        }

        const possiblePatterns = [
            // 基础属性匹配
            `${escapeRegExp(object.name)}\\.${prop}(\$$.*\$$)?$`,
            `${escapeRegExp(object.uuid)}\\.${prop}(\$$.*\$$)?$`,

            // 层级结构匹配
            `([^/]+/)*${escapeRegExp(object.name)}\\.${prop}(\$$.*\$$)?$`,

            // 材质属性匹配
            `${escapeRegExp(object.name)}\\.material\\.${prop}(\$$.*\$$)?$`,
            `${escapeRegExp(object.uuid)}\\.material\\.${prop}(\$$.*\$$)?$`,

            // 骨骼动画匹配
            `\\.bone\$$${escapeRegExp(object.name)}[^\$$]*\\]\\.${prop}$`,

            // 带命名空间的场景对象匹配
            `scene:[^:]+:${escapeRegExp(object.name)}\\.${prop}$`
        ];

        const fullPattern = new RegExp(
            `^(?:${possiblePatterns.join('|')})`,
            'i'
        );

        return clip.tracks.find(track => fullPattern.test(track.name));
    }

    /**
     * 创建空动画对象
     * @param name 动画对象名称
     * @param object 绑定动画的对象
     */
    createEmptyAnimation(name: string, object: THREE.Object3D | null = null) {
        if (!object) {
            object = App.selected;

            if (!object) return;
        }

        let mixer = this.mixerMap.get(object.uuid);
        if (!mixer) {
            mixer = new THREE.AnimationMixer(object);
            this.mixerMap.set(object.uuid, mixer);
        }

        const clip = new THREE.AnimationClip(name, 0, []);
        const clipAction = mixer.clipAction(clip);
        // @ts-ignore
        object.animations.push(clipAction);
        this.actionMap.set(clip.uuid, clipAction);

        return clipAction;
    }

    /**
     * 重新剪辑action
     * @param action 动画action
     * @param currentTime 动画停住的时间点
     * @returns action 重剪辑后的action
     */
    reClipAction(action: THREE.AnimationAction, currentTime = 0) {
        const currentClip = action.getClip();
        const currentObject = action.getRoot();
        const currentMixer = action.getMixer();
        // 重剪辑前动画是否是激活的
        const isScheduled = action.isScheduled();

        const actionIndex = currentObject.animations.findIndex((a: THREE.AnimationAction | THREE.AnimationClip) => (a === action || a === currentClip));
        const property = {
            time: currentTime || action.time,
            timeScale: action.timeScale,
            clampWhenFinished: action.clampWhenFinished,
            loop: action.loop,
            weight: action.weight,
            enabled: action.enabled,
            paused: action.paused,
            repetitions: action.repetitions,
            zeroSlopeAtEnd: action.zeroSlopeAtEnd,
            zeroSlopeAtStart: action.zeroSlopeAtStart,
        };
        action.stop();
        currentMixer.uncacheClip(currentClip);

        const newAction = currentMixer.clipAction(currentClip, currentObject);
        // 同步属性
        Object.assign(newAction, property);

        // @ts-ignore
        currentObject.animations.splice(actionIndex, 1, newAction);
        action = newAction;

        this.actionMap.set(currentClip.uuid, newAction);

        // 如果动作没激活过则激活一次
        if (isScheduled && !action.isScheduled()) {
            action.play();
            action.paused = true;
        }

        return action;
    }

    update(delta: number) {
        needsUpdate = false;

        this.mixerMap.forEach(mixer => {
            // @ts-ignore
            const actions = mixer.stats.actions;
            if (actions.inUse > 0) {
                prevActionsInUse = actions.inUse;

                mixer.update(delta);

                useDispatchSignal("animationMixerUpdate", mixer, delta)

                needsUpdate = true;
            }
        })

        if (!needsUpdate && prevActionsInUse > 0) {
            prevActionsInUse = 0;
            needsUpdate = true;
        }

        return needsUpdate;
    }
}

/**
 * 关键帧轨道创建工厂函数
 * @param name 轨道名称
 * @param times 关键帧时间点数组
 * @param values 关键帧值数组
 * @param interpolation 插值类型
 */
export const KeyframeTrackFactory = (name: string, times: number[], values: any[], interpolation: THREE.InterpolationModes = THREE.InterpolateLinear) => {
    // 按 '.' 分割，取最后一段（如 'nodeName.property[accessor]'）
    const lastSegment = name.split('.').pop();
    // 再按 '[' 分割，取第一部分（如 'property'）
    const attr = lastSegment?.split('[')[0];

    if (!attr) {
        return new THREE.KeyframeTrack(name, times, values, interpolation);
    }

    switch (attr) {
        case 'position':
        case 'rotation':
        case 'scale':
            return new THREE.VectorKeyframeTrack(name, times, values, interpolation);
        case 'quaternion':
            return new THREE.QuaternionKeyframeTrack(name, times, values, interpolation);
        case 'visible':
        // 启用 alpha 覆盖
        case 'alphaToCoverage':
        // 是否渲染材质的颜色
        case 'colorWrite':
        // 是否在渲染此材质时启用深度测试
        case 'depthTest':
        // 渲染此材质是否对深度缓冲区有任何影响
        case 'depthWrite':
        // 定义这个材质是否会被渲染器的toneMapping设置所影响
        case 'toneMapped':
        // 定义此材质是否透明
        case 'transparent':
        // 是否使用顶点着色
        case 'vertexColors':
        // 大小衰减
        case 'sizeAttenuation':
        // 平面着色
        case 'flatShading':
        // 线框模式
        case 'wireframe':
            return new THREE.BooleanKeyframeTrack(name, times, values);
        case 'color':
        // 高光
        case 'specular':
        // 自发光
        case 'emissive':
        // 光泽颜色
        case 'sheenColor':
        // 衰减色
        case 'attenuationColor':
        // 表示恒定混合颜色的 RGB 值
        case 'blendColor':
        // TODO: 待补充说明
        case 'groundcolor':
            return new THREE.ColorKeyframeTrack(name, times, values, interpolation);
        // 在0.0 - 1.0的范围内的浮点数，表明材质的透明度。值0.0表示完全透明，1.0表示完全不透明
        case 'opacity':
        // 表示光源的强度
        case 'intensity':
        // 表示恒定混合颜色的 alpha 值
        case 'blendAlpha':
        // 设置运行alphaTest时要使用的alpha值
        case 'alphaTest':
        // 定义将要渲染哪一面 - 正面，背面或两者
        case 'side':
        // 摄像机视锥体垂直视野角度，从视图的底部到顶部，以角度来表示
        case 'fov':
        // 用于立体视觉和景深效果的物体的距离
        case 'focus':
        // 摄像机的远端面
        case 'far':
        // 摄像机的近端面
        case 'near':
        // 摄像机视锥体的长宽比
        case 'aspect':
        // 获取或者设置摄像机的缩放倍数
        case 'zoom':
        // TODO: 待补充说明
        case 'distance':
        // 渲染顺序
        case 'renderOrder':
        // 高光大小
        case 'shininess':
        // 反射率
        case 'reflectivity':
        // 粗糙度
        case 'roughness':
        // 金属度
        case 'metalness':
        // 清漆
        case 'clearcoat':
        // 清漆粗糙度
        case 'clearcoatRoughness':
        // 彩虹色
        case 'iridescence':
        // 彩虹色折射率
        case 'iridescenceIOR':
        // 光泽
        case 'sheen':
        // 光泽粗糙度
        case 'sheenRoughness':
        // 透光度
        case 'transmission':
        // 衰减距离
        case 'attenuationDistance':
        // 厚度
        case 'thickness':
        // 大小
        case 'size':
            return new THREE.NumberKeyframeTrack(name, times, values, interpolation);
        // 此处仅为占位说明还有 StringKeyframeTrack
        // case "uuid":
        //     return new THREE.StringKeyframeTrack(name, times, values);
        default:
            return new THREE.KeyframeTrack(name, times, values, interpolation);
    }
}