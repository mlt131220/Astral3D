/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2024/08/28
 * @description 漫游类，使用BVH检测碰撞,人物模型必须包含动画：Enter,Idle, Walking, WalkingBackward,Jumping
 */
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GenerateMeshBVHWorker } from '#/workers/bvh/GenerateMeshBVHWorker.js';
import { useDispatchSignal } from "#/hooks";
import { getMeshByInstancedMesh } from "#/utils";
import { RoamingStatus } from "./RoamingStatus";
import Loader from "#/core/loader/Loader";
import App from "#/core/app/App";
import Viewer from "#/core/viewer/Viewer";
import MergeGeometriesWorker from "#/workers/mergeGeometries.worker.ts?worker&url";

let keyDownFn, keyUpFn;

class Roaming {
    private viewer: Viewer;
    private controls: CameraControls;

    group: THREE.Group;
    private collider: THREE.Mesh | undefined; // 碰撞器
    private player: THREE.Mesh | undefined; // 碰撞胶囊体
    person: THREE.Group | undefined; // 人物

    private playerIsOnGround = true;
    private playerVelocity = new THREE.Vector3();
    private gravity = -25; // 重力
    private playerSpeed = 3; // 人物移动速度
    playerInitPos = new THREE.Vector3(0, 0, 0); // 人物初始位置
    private firstPerson = true; // 是否第一人称

    // 按键监听
    private fwdPressed = false;
    private bkdPressed = false;
    private lftPressed = false;
    private rgtPressed = false;

    private upVector = new THREE.Vector3(0, 1, 0);
    private tempVector = new THREE.Vector3();
    private tempVector2 = new THREE.Vector3();
    private tempBox = new THREE.Box3();
    private tempMat = new THREE.Matrix4();
    private tempSegment = new THREE.Line3();

    public isRoaming = false; // 是否在漫游
    mergeWorker: Worker;
    private generateMeshBVHWorker: GenerateMeshBVHWorker;
    private personStatus: RoamingStatus | null = null;

    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.controls = viewer.modules.controls;

        keyDownFn = this.keyDown.bind(this);
        window.addEventListener('keydown', keyDownFn);

        keyUpFn = this.keyUp.bind(this);
        window.addEventListener('keyup', keyUpFn);

        this.group = new THREE.Group();
        this.group.name = "es-3d-roaming-group";
        this.group.visible = false;
        this.group.ignore = true;

        this.mergeWorker = new Worker(MergeGeometriesWorker, { type: 'module' });
        this.generateMeshBVHWorker = new GenerateMeshBVHWorker();

        this.addPlayer();
    }

    keyDown(e: KeyboardEvent) {
        if (!this.isRoaming || e.repeat) return;

        switch (e.code) {
            case 'KeyW':
                this.fwdPressed = true;
                this.personStatus?.setStatus("w", true);
                break;
            case 'KeyS':
                this.bkdPressed = true;
                this.personStatus?.setStatus("s", true);
                break;
            case 'KeyD':
                this.rgtPressed = true;
                this.personStatus?.setStatus("d", true);
                break;
            case 'KeyA':
                this.lftPressed = true;
                this.personStatus?.setStatus("a", true);
                break;
            case 'Space':
                if (this.personStatus?.keyDownStatus.space) return;

                if (this.playerIsOnGround) {
                    // 跳跃动画有30FPS准备动作
                    setTimeout(() => {
                        this.playerVelocity.y = 10.0;
                        this.playerIsOnGround = false;
                    }, (30 / App.FPS) * 1000)
                }
                this.personStatus?.setStatus("space", true);
                break;
            case "ShiftLeft":
            case "ShiftRight":
                if (this.personStatus?.isWalkingForward) {
                    this.playerSpeed = 6;
                    this.personStatus?.setStatus("shift", true);
                }
                break;
            case 'KeyV': // 切换第一/第三人称视角
                this.firstPerson = !this.firstPerson;

                if (this.firstPerson) { //人称切换
                    // 第一人称
                    this.controls.maxPolarAngle = Math.PI / 2;
                    this.controls.minDistance = 0.8;
                    this.controls.maxDistance = 0.8;
                    this.controls.distance = 0.8;
                } else {
                    this.controls.maxPolarAngle = Math.PI / 2;
                    this.controls.minDistance = 6;
                    this.controls.maxDistance = 6;
                    this.controls.distance = 6;
                }
                break;
        }
    }

    keyUp(e: KeyboardEvent) {
        if (!this.isRoaming || e.repeat) return;

        switch (e.code) {
            case 'KeyW':
                this.personStatus?.setStatus("w", false);
                this.fwdPressed = false;
                break;
            case 'KeyS':
                this.personStatus?.setStatus("s", false);
                this.bkdPressed = false;
                break;
            case 'KeyD':
                this.personStatus?.setStatus("d", false);
                this.rgtPressed = false;
                break;
            case 'KeyA':
                this.personStatus?.setStatus("a", false);
                this.lftPressed = false;
                break;
            case "ShiftLeft":
            case "ShiftRight":
                this.playerSpeed = 3;
                this.personStatus?.setStatus("shift", false);
                break;
        }
    }

    // 添加漫游所需人物模型
    addPlayer() {
        // 几何圆柱体 用于碰撞检测
        const cylinder = new THREE.Mesh(
            new RoundedBoxGeometry(0.5, 1.7, 0.5, 10, 0.5),
            new THREE.MeshStandardMaterial()
        )
        cylinder.geometry.translate(0, -0.6, 0);
        // @ts-ignore
        cylinder.capsuleInfo = {
            radius: 0.4,
            segment: new THREE.Line3(new THREE.Vector3(), new THREE.Vector3(0, -1.0, 0.0))
        }
        cylinder.name = 'es-3d-roaming-cylinder';
        cylinder.visible = false;

        this.player = cylinder;
        this.group.add(cylinder);

        this.reloadPerson();
    }

    /**
     * 重置漫游人物模型
     */
    async reloadPerson() {
        // 加载人物模型glb
        const loader = await Loader.createGLTFLoader();

        const done = (blob) => {
            // 加载人物模型Blob
            loader.loadAsync(URL.createObjectURL(blob)).then(result => {
                const person = result.scene as THREE.Group;
                person.name = "es-3d-roaming-player";

                if (this.person) {
                    person.matrix.copy(this.person.matrix);
                    person.matrixWorld.copy(this.person.matrixWorld);

                    this.person.removeFromParent();
                }

                this.person = person;
                this.group.add(person);

                // 漫游人物动画状态机
                if (this.personStatus) {
                    this.personStatus.dispose();
                }
                this.personStatus = new RoamingStatus(person, result.animations);
            });
        }

        // 从本地DB读取人物模型
        const playerConfig = App.config.getKey("roamingCharacter")
        App.storage.getModel(`player-${playerConfig}`).then((file: Blob | unknown) => {
            if (!file) {
                const playerGlbUrl = new URL(`${import.meta.env.BASE_URL}resource/model/${playerConfig}.glb`, import.meta.url).href;
                // 加载默认人物模型
                fetch(playerGlbUrl).then(res => res.blob()).then(blob => {
                    App.storage.setModel(`player-${playerConfig}`, blob)
                    done(blob);
                })
            } else {
                done(file);
            }
        })
    }

    // 生成碰撞器环境
    generateColliderEnvironment() {
        let mergedGeometry: any;

        // TODO：20251003 - environment组好像没有存在的意义？运行两个月无误后删除
        //const environment = new THREE.Group();
        //environment.name = "astral-3d-roaming-collider-environment";

        const generateBVH = () => {
            return new Promise(resolve => {
                this.generateMeshBVHWorker.generate(mergedGeometry).then(bvh => {
                    // @ts-ignore
                    mergedGeometry.boundsTree = bvh;

                    this.collider = new THREE.Mesh(mergedGeometry);
                    // @ts-ignore
                    this.collider.material.wireframe = false;
                    this.collider.name = "astral-3d-roaming-collider";
                    this.collider.visible = false;

                    // @ts-ignore
                    this.group.add(this.collider);

                    resolve("");

                    this.generateMeshBVHWorker.dispose();
                });

                //environment.visible = false;
                //this.group.add(environment);
                this.viewer.scene.add(this.group);
            })
        }

        const generateMergedGeometry = () => {
            return new Promise((resolve, reject) => {
                const cloneGeom = (me) => {
                    // 检查对应属性是否存在
                    if (!me.geometry.attributes || !me.geometry.attributes.position || me.geometry.attributes.position.isInterleavedBufferAttribute) return;

                    let geom = me.geometry.clone();
                    geom.applyMatrix4(me.matrixWorld);

                    // 合并仅保留position即可
                    geom.attributes = {
                        position: geom.toNonIndexed().attributes.position, // 取消position索引
                    }

                    // 手动纠正有些模型没有顶点索引的问题
                    if (geom.index) geom.index = null;

                    this.mergeWorker.postMessage({
                        type: "push",
                        // geometry: geom
                        // 合并在容差范围内的具有相似属性的顶点
                        geometry: BufferGeometryUtils.mergeVertices(geom)
                    })
                }

                this.viewer.scene.traverseByCondition(c => {
                    // requestIdleCallback(()=>{
                    // 只合并网格
                    if (c.geometry) {
                        // @ts-ignore
                        if (!c.isInstancedMesh) {
                            cloneGeom(c);
                        } else {
                            const meshes = getMeshByInstancedMesh(c as THREE.InstancedMesh);
                            meshes.forEach((m: THREE.Mesh) => {
                                cloneGeom(m);
                            });
                        }
                    }
                    // })
                }, (c) => !c.ignore && !c.isTilesGroup && !c.isTiles && c.visible)

                // requestIdleCallback(()=>{
                this.mergeWorker.postMessage({
                    type: "merge"
                })
                // })

                this.mergeWorker.onmessage = (event) => {
                    if (event.data.type === "error") {
                        // 有可能是纯3DTiles场景
                        if (this.viewer.modules.tilesManage.tilesMap.size === 0) {
                            reject(event.data.message);
                        } else {
                            resolve("");
                        }

                        return;
                    }

                    if (!event.data.geometry) return;

                    mergedGeometry = event.data.geometry;
                    mergedGeometry.__proto__ = THREE.BufferGeometry.prototype;
                    mergedGeometry.index && (mergedGeometry.index.__proto__ = THREE.BufferAttribute.prototype);
                    mergedGeometry.attributes.position.__proto__ = THREE.BufferAttribute.prototype;
                    mergedGeometry.attributes.normal && (mergedGeometry.attributes.normal.__proto__ = THREE.BufferAttribute.prototype);

                    // 删除uv属性
                    if (mergedGeometry.attributes.uv) {
                        mergedGeometry.deleteAttribute("uv");
                    }

                    // const newMesh = new THREE.Mesh(mergedGeometry, new THREE.MeshBasicMaterial());
                    //const newMesh = new THREE.Mesh(BufferGeometryUtils.mergeVertices(mergedGeometry), new THREE.MeshBasicMaterial());
                    //newMesh.visible = false;

                    //environment.add(newMesh);

                    generateBVH().then(() => {
                        resolve("");
                    });

                    // 关闭 worker
                    this.mergeWorker.terminate();
                }
            })
        }

        return generateMergedGeometry();
    }

    // 重置人物位置
    resetPlayer() {
        const player = this.player as THREE.Mesh;

        this.playerVelocity.set(0, 0, 0);
        player.position.copy(this.playerInitPos);

        // 播放模型进入动画
        this.personStatus?.init();

        const _target = new THREE.Vector3();
        this.controls.getTarget(_target);
        this.viewer.camera.position.sub(_target);
        this.controls.setTarget(player.position.x, player.position.y + 2, player.position.z, false);
        this.controls.distance = this.firstPerson ? 0.8 : 6;
        this.viewer.camera.position.add(player.position);
        this.controls.update(0.016);
    }

    // 进入漫游
    startRoaming() {
        if (this.isRoaming) return;

        this.group.visible = true;

        this.viewer.computedSceneBox3();

        this.resetPlayer();

        this.isRoaming = true;
    }

    // 退出漫游
    exitRoaming(lastRoadCameraPos = new THREE.Vector3(1, 1, 1), lastRoadCameraTarget = new THREE.Vector3()) {
        this.group.visible = false;

        lastRoadCameraPos && this.controls.setPosition(lastRoadCameraPos.x, lastRoadCameraPos.y, lastRoadCameraPos.z, true);
        lastRoadCameraTarget && this.controls.setTarget(lastRoadCameraTarget.x, lastRoadCameraTarget.y, lastRoadCameraTarget.z, true);

        this.controls.maxPolarAngle = Math.PI;
        this.controls.minDistance = 0;
        this.controls.maxDistance = Infinity;

        this.controls.update(0.016);
        this.isRoaming = false;

        // 停用混合器上所有预定的动作
        this.personStatus?.stopAllAction();

        useDispatchSignal("sceneGraphChanged");
    }

    render(delta: number) {
        if (!delta) return;

        const player = this.player as THREE.Object3D;

        // =========================
        // 重力与竖直方向
        // =========================
        if (this.playerIsOnGround) {
            this.playerVelocity.y = delta * this.gravity;
        } else {
            this.playerVelocity.y += delta * this.gravity;
        }
        player.position.addScaledVector(this.playerVelocity, delta);

        // =========================
        // 水平方向移动
        // =========================
        const angle = this.controls.azimuthAngle;
        if (this.fwdPressed) {
            this.tempVector.set(0, 0, -1).applyAxisAngle(this.upVector, angle);
            player.position.addScaledVector(this.tempVector, this.playerSpeed * delta);
        }
        if (this.bkdPressed) {
            this.tempVector.set(0, 0, 1).applyAxisAngle(this.upVector, angle);
            player.position.addScaledVector(this.tempVector, this.playerSpeed * delta);
        }
        if (this.lftPressed) {
            this.tempVector.set(-1, 0, 0).applyAxisAngle(this.upVector, angle);
            player.position.addScaledVector(this.tempVector, this.playerSpeed * delta);
        }
        if (this.rgtPressed) {
            this.tempVector.set(1, 0, 0).applyAxisAngle(this.upVector, angle);
            player.position.addScaledVector(this.tempVector, this.playerSpeed * delta);
        }

        player.updateMatrixWorld();

        // =========================
        // 碰撞检测
        // =========================
        // @ts-ignore
        const capsuleInfo = (player as any).capsuleInfo;
        const worldSegStart = capsuleInfo.segment.start.clone().applyMatrix4(player.matrixWorld);

        // 收集所有 collider mesh
        const colliders: THREE.Mesh[] = [];
        if (this.viewer.modules.tilesManage.mergeMesh) {
            colliders.push(this.viewer.modules.tilesManage.mergeMesh);
        }
        if (this.collider) colliders.push(this.collider);

        let chosenNewPositionWorld: THREE.Vector3 | null = null;
        let maxOffsetLen = -Infinity;

        for (const mesh of colliders) {
            if (!mesh.geometry?.boundsTree) continue;

            // 胶囊段：player.local → world → mesh.local
            this.tempMat.copy(mesh.matrixWorld).invert();
            this.tempSegment.copy(capsuleInfo.segment);
            this.tempSegment.start.applyMatrix4(player.matrixWorld).applyMatrix4(this.tempMat);
            this.tempSegment.end.applyMatrix4(player.matrixWorld).applyMatrix4(this.tempMat);

            // AABB for shapecast
            this.tempBox.makeEmpty();
            this.tempBox.expandByPoint(this.tempSegment.start);
            this.tempBox.expandByPoint(this.tempSegment.end);
            this.tempBox.min.addScalar(-capsuleInfo.radius);
            this.tempBox.max.addScalar(capsuleInfo.radius);

            // 执行 shapecast，会修改 this.tempSegment
            mesh.geometry.boundsTree.shapecast({
                intersectsBounds: box => box.intersectsBox(this.tempBox),
                intersectsTriangle: tri => {
                    // 检查三角形是否与胶囊相交，如果相交则调整胶囊位置。
                    const triPoint = this.tempVector;
                    const capsulePoint = this.tempVector2;

                    const distance = tri.closestPointToSegment(this.tempSegment, triPoint, capsulePoint);
                    if (distance < (this.player as THREE.Object3D).capsuleInfo.radius) {
                        const depth = (this.player as THREE.Object3D).capsuleInfo.radius - distance;
                        const direction = capsulePoint.sub(triPoint).normalize();

                        this.tempSegment.start.addScaledVector(direction, depth);
                        this.tempSegment.end.addScaledVector(direction, depth);
                    }

                    return false;
                }
            });

            // 结果变回 world 空间
            const adjustedWorld = this.tempSegment.start.clone().applyMatrix4(mesh.matrixWorld);

            const offsetLen = adjustedWorld.distanceTo(worldSegStart);
            if (offsetLen > maxOffsetLen) {
                maxOffsetLen = offsetLen;
                chosenNewPositionWorld = adjustedWorld;
            }
        }

        // 应用最终选择的位移
        if (chosenNewPositionWorld) {
            const deltaVector = this.tempVector2.subVectors(chosenNewPositionWorld, player.position);

            this.playerIsOnGround = deltaVector.y > Math.abs(delta * this.playerVelocity.y * 0.25);

            const offset = Math.max(0.0, deltaVector.length() - 1e-5);
            deltaVector.normalize().multiplyScalar(offset);

            player.position.add(deltaVector);

            if (!this.playerIsOnGround) {
                deltaVector.normalize();
                this.playerVelocity.addScaledVector(deltaVector, -deltaVector.dot(this.playerVelocity));
            } else {
                this.playerVelocity.set(0, 0, 0);
            }
        }

        // =========================
        // 相机调整
        // =========================
        const v = new THREE.Vector3(player.position.x, player.position.y + 0.2, player.position.z);
        const _target = new THREE.Vector3();
        this.controls.getTarget(_target);
        this.viewer.camera.position.sub(_target);
        this.controls.setTarget(v.x, v.y, v.z, false);
        this.controls.distance = this.firstPerson ? 0.8 : 6;
        this.viewer.camera.position.add(v);
        this.controls.polarAngle = Math.PI / 2;

        // 人物模型位置跟随
        if (this.person) {
            this.person.position.set(player.position.x, player.position.y - 1.415, player.position.z);
        }

        // 跌落检测
        if (this.viewer.sceneBox3 && (this.viewer.sceneBox3.min.y - player.position.y > 15)) {
            requestAnimationFrame(() => this.resetPlayer());
        }

        // 动画状态更新
        this.personStatus?.update(delta);
    }

    // render(delta: number) {
    //     if (!delta) return;
    //
    //     const player = this.player as THREE.Object3D;
    //
    //     if (this.playerIsOnGround) {
    //         this.playerVelocity.y = delta * this.gravity;
    //     } else {
    //         this.playerVelocity.y += delta * this.gravity;
    //     }
    //
    //     // 人物竖直方向移动（跳跃）
    //     player.position.addScaledVector(this.playerVelocity, delta);
    //
    //     /* 人物移动 */
    //     const angle = this.controls.azimuthAngle;
    //     if (this.fwdPressed) {
    //         this.tempVector.set(0, 0, -1).applyAxisAngle(this.upVector, angle);
    //         player.position.addScaledVector(this.tempVector, this.playerSpeed * delta);
    //     }
    //
    //     if (this.bkdPressed) {
    //         this.tempVector.set(0, 0, 1).applyAxisAngle(this.upVector, angle);
    //         player.position.addScaledVector(this.tempVector, this.playerSpeed * delta);
    //     }
    //
    //     if (this.lftPressed) {
    //         this.tempVector.set(-1, 0, 0).applyAxisAngle(this.upVector, angle);
    //         player.position.addScaledVector(this.tempVector, this.playerSpeed * delta);
    //     }
    //
    //     if (this.rgtPressed) {
    //         this.tempVector.set(1, 0, 0).applyAxisAngle(this.upVector, angle);
    //         player.position.addScaledVector(this.tempVector, this.playerSpeed * delta);
    //     }
    //
    //     player.updateMatrixWorld();
    //
    //     // @ts-ignore 根据碰撞调整位置
    //     const capsuleInfo = player.capsuleInfo;
    //     this.tempBox.makeEmpty();
    //     this.tempMat.copy((this.collider as THREE.Mesh).matrixWorld).invert();
    //     this.tempSegment.copy(capsuleInfo.segment);
    //
    //     // 获得胶囊在碰撞器的局部空间中的位置
    //     this.tempSegment.start.applyMatrix4(player.matrixWorld).applyMatrix4(this.tempMat);
    //     this.tempSegment.end.applyMatrix4(player.matrixWorld).applyMatrix4(this.tempMat);
    //
    //     // 获取胶囊的轴对齐边界框
    //     this.tempBox.expandByPoint(this.tempSegment.start);
    //     this.tempBox.expandByPoint(this.tempSegment.end);
    //     this.tempBox.min.addScalar(-capsuleInfo.radius);
    //     this.tempBox.max.addScalar(capsuleInfo.radius);
    //
    //     this.collider?.geometry.boundsTree?.shapecast({
    //         intersectsBounds: box => box.intersectsBox(this.tempBox),
    //         intersectsTriangle: tri => {
    //             // 检查三角形是否与胶囊相交，如果相交则调整胶囊位置。
    //             const triPoint = this.tempVector;
    //             const capsulePoint = this.tempVector2;
    //
    //             const distance = tri.closestPointToSegment(this.tempSegment, triPoint, capsulePoint);
    //             if (distance < (this.player as THREE.Object3D).capsuleInfo.radius) {
    //                 const depth = (this.player as THREE.Object3D).capsuleInfo.radius - distance;
    //                 const direction = capsulePoint.sub(triPoint).normalize();
    //
    //                 this.tempSegment.start.addScaledVector(direction, depth);
    //                 this.tempSegment.end.addScaledVector(direction, depth);
    //             }
    //
    //             return false;
    //         }
    //     });
    //
    //     if(this.viewer.modules.tilesManage.tilesMap.size > 0){
    //         this.viewer.modules.tilesManage.mergeMesh?.geometry.boundsTree?.shapecast({
    //             intersectsBounds: box => box.intersectsBox(this.tempBox),
    //             intersectsTriangle: tri => {
    //                 // 检查三角形是否与胶囊相交，如果相交则调整胶囊位置。
    //                 const triPoint = this.tempVector;
    //                 const capsulePoint = this.tempVector2;
    //
    //                 const distance = tri.closestPointToSegment(this.tempSegment, triPoint, capsulePoint);
    //                 if (distance < (this.player as THREE.Object3D).capsuleInfo.radius) {
    //                     const depth = (this.player as THREE.Object3D).capsuleInfo.radius - distance;
    //                     const direction = capsulePoint.sub(triPoint).normalize();
    //
    //                     this.tempSegment.start.addScaledVector(direction, depth);
    //                     this.tempSegment.end.addScaledVector(direction, depth);
    //                 }
    //
    //                 return false;
    //             }
    //         });
    //     }
    //
    //     // 在检查三角形碰撞并移动后，获得胶囊碰撞器在世界空间中的调整位置。假设capsule.info.segment.start是玩家模型的原点。
    //     const newPosition = this.tempVector;
    //     newPosition.copy(this.tempSegment.start).applyMatrix4((this.collider as THREE.Mesh).matrixWorld);
    //
    //     // 检查碰撞器移动了多少
    //     const deltaVector = this.tempVector2;
    //     deltaVector.subVectors(newPosition, player.position);
    //
    //     // 如果玩家主要是垂直调整，我们就会认为它是在地面上
    //     this.playerIsOnGround = deltaVector.y > Math.abs(delta * this.playerVelocity.y * 0.25);
    //
    //     const offset = Math.max(0.0, deltaVector.length() - 1e-5);
    //     deltaVector.normalize().multiplyScalar(offset);
    //
    //     // 调整玩家模型的位置;
    //     player.position.add(deltaVector);
    //     if (!this.playerIsOnGround) {
    //         deltaVector.normalize();
    //         this.playerVelocity.addScaledVector(deltaVector, -deltaVector.dot(this.playerVelocity));
    //     } else {
    //         this.playerVelocity.set(0, 0, 0);
    //     }
    //
    //     // 调整相机
    //     const v = new THREE.Vector3(player.position.x, player.position.y + 0.2, player.position.z);
    //     const _target = new THREE.Vector3();
    //     this.controls.getTarget(_target);
    //     this.viewer.camera.position.sub(_target);
    //     this.controls.setTarget(v.x, v.y, v.z, false);
    //     this.controls.distance = this.firstPerson ? 0.8 : 6;
    //     this.viewer.camera.position.add(v);
    //     this.controls.polarAngle = Math.PI / 2;
    //
    //     if (this.person) {
    //         const p = player.position.clone();
    //         this.person.position.set(p.x, p.y - 1.415, p.z);
    //     }
    //
    //     //如果玩家跌得太低，将他们的位置重置到起点
    //     if (this.viewer.sceneBox3 && (this.viewer.sceneBox3.min.y - player.position.y > 15)) {
    //         this.resetPlayer();
    //     }
    //
    //     this.personStatus?.update(delta);
    // }

    dispose() {
        window.removeEventListener('keydown', keyDownFn);
        window.removeEventListener('keyup', keyUpFn);

        App.removeObject(this.group);

        this.personStatus?.dispose();
    }
}

export { Roaming }