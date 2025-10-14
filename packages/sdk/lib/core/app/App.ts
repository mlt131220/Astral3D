/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2025/4/22 10:16
 * @description 静态类，全局场景管理
 */
import * as THREE from 'three';
// 原生three的扩展
import '../expansion';
import Logger from "#/utils/log/Logger";
import { Config, Storage, Project, Selector, History as _History, Resource, CSM } from "./modules";
import { AnimationManager } from "../animation/AnimationManager";
import { useAddSignal, useDispatchSignal, useSetSignalActive } from '#/hooks';
import Loader from "#/core/loader/Loader.ts";
import { AddScriptCommand, RemoveScriptCommand } from "#/core/commands/Commands.ts";
import Viewer from "#/core/viewer/Viewer.ts";

const _DEFAULT_CAMERA = new THREE.PerspectiveCamera(45, 1, 0.01, 100 * 1000);
_DEFAULT_CAMERA.name = "默认相机";
_DEFAULT_CAMERA.position.set(0, 5, 10);
_DEFAULT_CAMERA.lookAt(new THREE.Vector3());

export class App {
    /**
     * 默认场景
     */
    public scene: THREE.Scene = new THREE.Scene();

    /**
     * 辅助场景
     */
    public sceneHelpers: THREE.Scene = new THREE.Scene();

    /**
     * 场景默认相机
     */
    public camera: THREE.PerspectiveCamera = _DEFAULT_CAMERA.clone();

    /**
     * 当前视口正在使用的相机
     */
    public viewportCamera: THREE.Camera = this.camera;

    /**
     * 当前视口渲染模式
     */
    public viewportShading: string = 'default';

    /**
     * 场景中的几何数据集合
     */
    public geometries: { [uuid: string]: THREE.BufferGeometry } = {};

    /**
     * 场景中的材质集合
     */
    public materials: { [uuid: string]: THREE.Material } = {};

    /**
     * 场景中的贴图集合
     */
    public textures: { [uuid: string]: THREE.Texture } = {};

    /**
     * 场景中的脚本集合
     */
    public scripts: ISceneJson['scripts'] = {};

    /**
     * 场景中的辅助集合
     */
    public helpers: Record<number, THREE.Object3D> = {};

    /**
     * 场景中的相机集合
     */
    public cameras: { [uuid: string]: THREE.Camera } = {};

    /**
     * 场景元数据（即记录更改前的数据以等待还原）
     */
    public metadata: Record<string, any> = {};

    /**
     * 跟踪材质使用的频率
     */
    protected materialsRefCounter: Map<object, number> = new Map();

    /**
     * 场景选中的模型
     */
    public selected: THREE.Object3D | null = null;

    /**
     * 场景锁定的模型
     */
    public locked: THREE.Object3D | null = null;

    /**
     * 日志记录
     */
    public log: typeof Logger = Logger;

    /**
     * 本地indexDB
     */
    public storage: Storage = new Storage();

    /**
     * 配置项
     */
    public config: Config = new Config(this.storage);

    /**
     * 当前工程相关，包括当前工程配置
     */
    public project: Project = new Project(this);

    /**
     * 模型选择器
     */
    public selector: Selector = new Selector();

    /**
     * 历史记录
     */
    public history: _History = new _History();

    /**
     * 资源管理
     */
    public resource: Resource = new Resource();

    /**
     * 全局动画管理
     */
    public animationManager: AnimationManager = new AnimationManager();

    /**
     * 级联阴影映射
     */
    public csm: CSM = new CSM(this.project.getKey("csm") as IAppProject.CSM);

    /**
     * 间隔多长时间渲染渲染一次,用于固定fps上限（单位秒）
     */
    public singleFrameTime: number = 1 / this.FPS;

    /**
     * 当前视口示例，实例化视口时赋值
     */
    public viewer: Viewer | null = null;

    constructor() {
        this.scene.name = "默认场景";

        this.addCamera(this.camera);

        useAddSignal("objectFocusByUuid", this.focusByUuid.bind(this))
    }

    /**
     * 获取渲染帧率上限
     */
    get FPS(): number {
        return this.project.getKey("renderer.fps");
    }

    /**
     * 设置渲染帧率上限
     * @param fps
     */
    set FPS(fps: number) {
        this.project.setKey("renderer.fps", fps, false);

        this.singleFrameTime = fps ? (1 / fps) : 0;
    }

    /**
     * 设置初始配置
     */
    setConfig(_config: Record<string, any>) {
        this.config.setConfig(_config);
    }

    /**
     * 生成场景
     * @param scene
     */
    setScene(scene: THREE.Scene) {
        this.scene.copy(scene, false)
        // copy方法不会复制uuid，需要手动赋值
        this.scene.uuid = scene.uuid;
        if (this.scene.animations && this.scene.animations.length > 0) this.clipAction(this.scene);

        // 避免对象渲染
        useSetSignalActive('sceneGraphChanged', false);

        while (scene.children.length > 0) {
            this.addObject(scene.children[0]);
        }

        useSetSignalActive('sceneGraphChanged', true);
        useDispatchSignal('sceneGraphChanged');

        return this.scene;
    }

    /**
     * 剪辑动画
     * @param object
     */
    clipAction(object: THREE.Object3D) {
        if (!object.animations || !object.animations.length) return;

        // 每个包含动画的模型都会有自己的混合器，因为如果采用共用scene混合器方案会造成全场景动画播放进度统一的情况
        let mixer = this.animationManager.mixerMap.get(object.uuid);
        if (!mixer) {
            mixer = new THREE.AnimationMixer(object);
            this.animationManager.mixerMap.set(object.uuid, mixer);
        }

        object.animations.forEach((animation, index) => {
            if ((animation instanceof THREE.AnimationAction) && animation.getClip()) {
                this.animationManager.actionMap.set(animation.getClip().uuid, animation)

                return;
            }

            if (!(animation instanceof THREE.AnimationClip)) return;

            const action = (<THREE.AnimationMixer>mixer).clipAction(animation, object);
            // @ts-ignore
            object.animations[index] = action;

            this.animationManager.actionMap.set(animation.uuid, action);
        })
    }

    /**
     * 添加模型
     * @param object
     * @param parent
     * @param index
     */
    addObject(object: THREE.Object3D, parent?: THREE.Object3D, index?: number) {
        object.traverseByCondition((child) => {
            if (child.animations && child.animations.length > 0) this.clipAction(child);
            if (child.geometry !== undefined) this.addGeometry(child.geometry);
            if (child.material !== undefined) this.addMaterial(child.material);
            this.addCamera(child);
            this.addHelper(child);

            // 20250325: 除灯光外默认全打开接收与投射阴影
            if (child.isLight) return;

            child.castShadow = true;
            child.receiveShadow = true;
        }, (child) => !child.ignore);

        if (parent === undefined) {
            this.scene.add(object);
        } else {
            parent.children.splice(index || 0, 0, object);
            object.parent = parent;
        }

        useDispatchSignal('objectAdded', object);
        useDispatchSignal('sceneGraphChanged');
    }

    /**
     * 移动模型
     * @param object
     * @param parent
     * @param before
     */
    moveObject(object: THREE.Object3D, parent: THREE.Object3D, before: THREE.Object3D) {
        if (parent === undefined) {
            parent = this.scene;
        }

        parent.add(object);

        // 对子数组进行排序
        if (before !== undefined) {
            const index = parent.children.indexOf(before);
            parent.children.splice(index, 0, object);
            parent.children.pop();
        }

        useDispatchSignal('sceneGraphChanged');
    }

    /**
     * 重命名模型
     * @param object
     * @param name
     */
    nameObject(object: THREE.Object3D, name: string) {
        object.name = name;
        useDispatchSignal('sceneGraphChanged');
    }

    /**
     * 移除模型
     * @param object
     */
    removeObject(object: THREE.Object3D) {
        // 由于含有ignore属性的对象与业务关联，不受scene管控
        // object.parent === null避免删除相机或场景
        if (object.parent === null || object.ignore) return;

        object.traverseByCondition((child: THREE.Object3D) => {
            this.removeCamera(child);
            this.removeHelper(child);
            if (child.material !== undefined) this.removeMaterial(child.material);
        }, (child: THREE.Object3D) => !child.ignore);

        object.parent.remove(object);

        useDispatchSignal('objectRemoved', object);
        useDispatchSignal('sceneGraphChanged');
    }

    /**
     * 添加几何数据
     * @param geometry
     */
    addGeometry(geometry: THREE.BufferGeometry) {
        this.geometries[geometry.uuid] = geometry;
    }

    /**
     * 设置几何名称
     * @param geometry
     * @param name
     */
    setGeometryName(geometry: THREE.BufferGeometry, name: string) {
        geometry.name = name;
        useDispatchSignal('sceneGraphChanged');
    }

    /**
     * 场景中新增材质
     * @param material
     */
    addMaterial(material: THREE.Material | THREE.Material[]) {
        if (Array.isArray(material)) {
            for (let i = 0, l = material.length; i < l; i++) {
                this.addMaterialToRefCounter(material[i]);
            }
        } else {
            this.addMaterialToRefCounter(material);
        }

        useDispatchSignal('materialAdded');
    }

    /**
     * 新增材质的使用计数
     * @param material
     */
    addMaterialToRefCounter(material: THREE.Material) {
        let materialsRefCounter = this.materialsRefCounter;
        let count = materialsRefCounter.get(material);

        if (count === undefined) {
            materialsRefCounter.set(material, 1);
            this.materials[material.uuid] = material;

            // 材质添加到csm
            this.csm.setupMaterial(material);
            material.needsUpdate = true;
        } else {
            count++;
            materialsRefCounter.set(material, count);
        }
    }

    /**
     * 场景中移除材质
     * @param material
     */
    removeMaterial(material: THREE.Material | THREE.Material[]) {
        if (Array.isArray(material)) {
            for (let i = 0, l = material.length; i < l; i++) {
                this.removeMaterialFromRefCounter(material[i]);
            }
        } else {
            this.removeMaterialFromRefCounter(material);
        }

        useDispatchSignal('materialRemoved');
    }

    /**
     * 移除材质时减少对应材质使用计数
     * @param material
     */
    removeMaterialFromRefCounter(material: THREE.Material) {
        let materialsRefCounter = this.materialsRefCounter;
        let count = materialsRefCounter.get(material) as number;
        count--;

        if (count === 0) {
            materialsRefCounter.delete(material);
            delete this.materials[material.uuid];
        } else {
            materialsRefCounter.set(material, count);
        }
    }

    /**
     * 通过材质uuid获取材质
     * @param uuid
     */
    getMaterialByUuid(uuid: string) {
        return this.materials[uuid];
    }

    /**
     * 设置材质名称
     * @param material
     * @param name
     */
    setMaterialName(material: THREE.Material, name: string) {
        material.name = name;
        useDispatchSignal('sceneGraphChanged');
    }

    /**
     * 场景中新增贴图
     * @param texture
     */
    addTexture(texture: THREE.Texture) {
        this.textures[texture.uuid] = texture;
    }

    /**
     * 场景中新增相机
     * @param camera
     */
    addCamera(camera: THREE.Camera) {
        if (camera.isCamera) {
            this.cameras[camera.uuid] = camera;
            useDispatchSignal('cameraAdded', camera);
        }
    }

    /**
     * 场景中移除相机
     * @param camera
     */
    removeCamera(camera: THREE.Camera | THREE.Object3D) {
        if (this.cameras[camera.uuid] !== undefined) {
            delete this.cameras[camera.uuid];
            useDispatchSignal('cameraRemoved', camera);
        }
    }

    /**
     * 场景中新增三维辅助工具
     * @param object
     * @param helper
     */
    addHelper(object: any, helper?: THREE.Object3D) {
        if (helper === undefined) {
            if (object.isCamera) {
                helper = new THREE.CameraHelper(object);
            } else if (object.isPointLight) {
                helper = new THREE.PointLightHelper(object, 1);
            } else if (object.isDirectionalLight) {
                helper = new THREE.DirectionalLightHelper(object, 1);
            } else if (object.isSpotLight) {
                helper = new THREE.SpotLightHelper(object);
            } else if (object.isHemisphereLight) {
                helper = new THREE.HemisphereLightHelper(object, 1);
            } else if (object.isSkinnedMesh && object.skeleton?.bones) {
                helper = new THREE.SkeletonHelper(object.skeleton.bones[0]);
            } else if (object.isBone && object.parent?.isBone !== true) {
                helper = new THREE.SkeletonHelper(object);
            } else {
                // no helper for this object type
                return;
            }

            let geometry = new THREE.SphereGeometry(2, 4, 2);
            let material = new THREE.MeshBasicMaterial({ color: 0xff0000, visible: false });
            const picker = new THREE.Mesh(geometry, material);
            picker.name = 'picker';
            picker.proxy = object;
            helper.add(picker);
        }

        this.sceneHelpers.add(helper);
        this.helpers[object.id] = helper;
    }

    /**
     * 移除某个模型上的三维辅助工具
     * @param object
     */
    removeHelper(object: THREE.Object3D) {
        if (this.helpers[object.id] !== undefined) {
            const helper = this.helpers[object.id];
            helper.parent?.remove(helper);
            delete this.helpers[object.id];
        }
    }

    /**
     * 新增脚本
     * @param object
     * @param script
     */
    addScript(object: THREE.Object3D, script: ISceneScript) {
        this.execute(new AddScriptCommand(object, script));
    }

    /**
     * 移除脚本
     * @param object
     * @param script
     */
    removeScript(object: THREE.Object3D, script: ISceneScript) {
        this.execute(new RemoveScriptCommand(object, script));
    }

    /**
     * 获取模型材质
     * @param object
     * @param slot
     */
    getObjectMaterial(object: THREE.Object3D, slot: number) {
        let material = object.material;

        if (Array.isArray(material) && slot !== undefined) {
            material = material[slot];
        }
        return material;
    }

    /**
     * 设置模型材质
     * @param object
     * @param slot
     * @param newMaterial
     */
    setObjectMaterial(object: THREE.Object3D, slot: number | undefined, newMaterial: THREE.Material) {
        if (Array.isArray(object.material) && slot !== undefined) {
            object.material[slot] = newMaterial;
        } else {
            object.material = newMaterial;
        }
    }

    /**
     * 设置当前视图相机
     * @param uuid
     */
    setViewportCamera(uuid: string) {
        this.viewportCamera = this.cameras[uuid];
        useDispatchSignal('viewportCameraChanged');
    }

    /**
     * 设置当前视图渲染方式
     * @param value
     */
    setViewportShading(value: string) {
        this.viewportShading = value;
        useDispatchSignal("viewportShadingChanged");
    }

    /**
     * 选中模型
     * @param object
     */
    select(object: THREE.Object3D) {
        this.selector.select(object);
    }

    /**
     * 通过模型id选中模型
     * @param id
     */
    selectById(id: number) {
        if (id === this.camera.id) {
            this.select(this.camera);
            return;
        }

        const obj = this.scene.getObjectById(id);

        obj && this.select(obj);
    }

    /**
     * 通过模型uuid选中模型
     * @param uuid
     */
    selectByUuid(uuid: string) {
        const scope = this;
        this.scene.traverse(function (child: THREE.Object3D) {
            if (child.uuid === uuid) {
                scope.select(child);
            }
        });
    }

    /**
     * 取消模型选中状态
     */
    deselect() {
        this.selector.deselect();
    }

    /**
     * 锁定模型
     * @param object
     */
    lock(object?: THREE.Object3D | null) {
        if (!object) {
            object = this.selected;
        }

        if (object) {
            this.locked = object;
            useDispatchSignal('objectLocked', object);
        }
    }

    /**
     * 取消模型锁定状态
     */
    unlock() {
        this.locked = null;
        useDispatchSignal('objectUnlocked');
    }

    /**
     * 相机聚焦模型
     * @param object
     */
    focus(object: THREE.Object3D) {
        if (object !== undefined) {
            useDispatchSignal('objectFocused', object);
        }
    }

    /**
     * 通过id聚焦模型
     * @param id
     */
    focusById(id: number) {
        const obj = this.scene.getObjectById(id);

        obj && this.focus(obj);
    }

    /**
     * 通过uuid聚焦模型
     * @param uuid
     */
    focusByUuid(uuid: string) {
        if (uuid === undefined) {
            this.deselect();
            return;
        }

        const obj = this.getObjectByUuid(uuid);
        obj && this.focus(obj);
    }

    /**
     * 通过uuid获取模型
     * @param uuid
     */
    getObjectByUuid(uuid: string) {
        return this.scene.getObjectByProperty('uuid', uuid);
    }

    /**
     * 遍历平铺所有子级mesh
     * @param object
     */
    traverseMeshToArr(object: THREE.Object3D) {
        if (object.isMesh) return [object];

        const arr: THREE.Mesh[] = [];
        object.traverse((item: THREE.Object3D) => {
            if (item.isMesh) {
                arr.push(item as THREE.Mesh);
            }
        })

        return arr;
    }

    /**
     * 获取不包含ignore属性模型的scene
     */
    getSceneWithoutIgnore() {
        const newScene = this.scene.clone(false);
        newScene.uuid = this.scene.uuid;
        this.scene.children.forEach((item) => {
            if (!item.ignore) {
                const model = item.clone();
                model.uuid = item.uuid;
                newScene.add(model);
            }
        })

        return newScene;
    }

    /**
     * 创建PBR材质
     * @param textures
     * @param properties
     */
    createPBRMaterial(textures: { [type: string]: string | THREE.Texture } = {}, properties: any = {}): Promise<THREE.MeshStandardMaterial> {
        return new Promise((resolve, reject) => {
            const material = new THREE.MeshStandardMaterial({
                // 位移贴图对网格的影响程度默认设置为0
                displacementScale: 0
            });

            properties && Object.keys(properties).forEach(key => {
                material[key] = properties[key];
            });

            const num = new Proxy({ value: 10 }, {
                set(target: { value: number }, p: string | symbol, newValue: any): boolean {
                    target[p] = newValue;
                    if (p === 'value' && newValue === 0) {
                        resolve(material);
                    }

                    return true;
                }
            })

            // 基础颜色贴图(高光反射/光泽度工作流:diffuse, 金属/粗糙度工作流:baseColor)
            if (textures.baseColor) {
                this.resource.loadURLTexture(textures.baseColor, (texture => {
                    material.map = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }

            // 法线贴图
            if (textures.normal) {
                this.resource.loadURLTexture(textures.normal, (texture => {
                    material.normalMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else if (textures.bump) {
                // 凹凸贴图(如果定义了法线贴图，则将忽略该贴图)
                this.resource.loadURLTexture(textures.bump, (texture => {
                    material.bumpMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }

            // 置换贴图(位移贴图)
            if (textures.displacement) {
                this.resource.loadURLTexture(textures.displacement, (texture => {
                    material.displacementMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }

            // 粗糙度贴图
            if (textures.roughness) {
                this.resource.loadURLTexture(textures.roughness, (texture => {
                    material.roughnessMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }

            // 金属度贴图
            if (textures.metalness) {
                this.resource.loadURLTexture(textures.metalness, (texture => {
                    material.metalnessMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }

            // 环境遮挡贴图
            if (textures.ao) {
                this.resource.loadURLTexture(textures.ao, (texture => {
                    material.aoMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }

            // 自发光贴图
            if (textures.emissive) {
                this.resource.loadURLTexture(textures.emissive, (texture => {
                    material.emissiveMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }

            // 透明贴图
            if (textures.alpha) {
                this.resource.loadURLTexture(textures.alpha, (texture => {
                    material.alphaMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }

            // 环境贴图（一般不会设置，因为会使用scene.environment）
            if (textures.env) {
                this.resource.loadURLTexture(textures.env, (texture => {
                    material.envMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }

            // 光照贴图
            if (textures.light) {
                this.resource.loadURLTexture(textures.light, (texture => {
                    material.lightMap = texture;

                    num.value--;
                }), err => {
                    reject(err);
                });
            } else {
                num.value--;
            }
        })
    }

    /**
     * 清空场景
     */
    clear() {
        this.history.clear();
        this.camera.copy(_DEFAULT_CAMERA);
        useDispatchSignal('cameraReset');
        this.scene.name = '默认场景';
        this.scene.position.set(0, 0, 0);
        this.scene.rotation.set(0, 0, 0);
        this.scene.userData = {};
        this.scene.background = null;
        this.scene.environment = null;
        this.scene.fog = null;

        for (let i = this.scene.children.length - 1; i >= 0; i--) {
            this.removeObject(this.scene.children[i]);
        }

        this.geometries = {};
        this.materials = {};
        this.textures = {};
        this.scripts = {};

        this.materialsRefCounter.clear();
        this.animationManager.mixerMap.forEach(mixer => mixer.stopAllAction());

        this.deselect();

        useDispatchSignal('sceneCleared');
    }

    /**
     * 从json数据生成场景
     * @param sceneJson
     */
    async fromJSON(sceneJson: ISceneJson) {
        //先清空场景
        this.clear();

        // 清除图纸状态
        this.project.resetDrawing();

        this.metadata = sceneJson.metadata || {};
        sceneJson.metadata = {};

        let loader = Loader.objectLoader;
        let camera = await loader.parseAsync(sceneJson.camera) as THREE.Camera;

        this.camera.copy(camera as THREE.PerspectiveCamera);
        useDispatchSignal('cameraReset');

        if (sceneJson.scripts) {
            this.scripts = sceneJson.scripts;
        }

        const scene = this.setScene(await loader.parseAsync(sceneJson.scene) as THREE.Scene);

        // 20250718: 环境类型是ModelViewer时需要手动设置，因为scene.toJSON()不会处理renderTargetTexture
        switch (sceneJson.scene.object.environmentType) {
            case "ModelViewer":
                useDispatchSignal("sceneEnvironmentChanged", 'ModelViewer');
                useDispatchSignal("sceneGraphChanged");
                break
        }

        return scene;
    }

    /**
     * 场景信息转JSON
     */
    toJSON() {
        // 脚本清理
        let scene = this.scene;
        let scripts = this.scripts;

        for (let key in scripts) {
            let script = scripts[key];
            if (script.length === 0 || scene.getObjectByProperty('uuid', key) === undefined) {
                delete scripts[key];
            }
        }

        const projectRender = this.project.getKey("renderer");
        return {
            metadata: {},
            project: {
                xr: this.project.getKey("xr"),
                antialias: projectRender.antialias,
                shadows: projectRender.shadows.enabled,
                shadowType: projectRender.shadows.type,
                toneMapping: projectRender.shadows.toneMapping,
                toneMappingExposure: projectRender.shadows.toneMappingExposure,
            },
            camera: this.camera.toJSON(),
            scene: this.scene.toJSON(),
            scripts: this.scripts,
            //history: this.history.toJSON(),
        };
    }

    /**
     * 执行历史记录中的命令
     * @param cmd
     * @param optionalName
     */
    execute(cmd, optionalName?: string) {
        this.history.execute(cmd, optionalName);
    }

    /**
     * 撤销
     */
    undo() {
        this.history.undo();
    }

    /**
     * 重做
     */
    redo() {
        this.history.redo();
    }
}

const app = new App();
export default app;