/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2025/9/23 21:31
 * @description 3d tiles加载管理
 */
import { TilesRenderer } from "3d-tiles-renderer";
import type { PriorityQueue } from "3d-tiles-renderer";
import { Mesh, Sphere, Vector3, Quaternion, Material, Scene, PerspectiveCamera, WebGLRenderer } from 'three';
import { MeshBVH, StaticGeometryGenerator,/*CENTER*/ } from 'three-mesh-bvh';
import Tiles from "#/core/objects/Tile.ts";

export class TilesManage {
    private scene: Scene;
    private camera: PerspectiveCamera;
    private renderer: WebGLRenderer;

    protected _tilesMergeMesh: Mesh | null = null;

    // Tiles BVH重建的监听函数
    rebuildBVHEventsTiles: Tiles[] = [];
    // 防抖计时器的 ID
    private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    // 防抖延迟（毫秒），可根据需要调整
    private debounceDelay: number = 50;
    // 防抖函数绑定
    private scheduleRebuildFn = this.scheduleRebuild.bind(this);

    // url -> Tiles[]
    tilesMap = new Map<string, Tiles[]>;

    // 共享队列(正确确定下载优先级)
    downloadQueue: PriorityQueue | null = null;
    parseQueue: PriorityQueue | null = null;
    processNodeQueue: PriorityQueue | null = null;

    needRender = false;

    constructor(scene: Scene, camera: PerspectiveCamera, renderer: WebGLRenderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
    }

    /**
     * 获取所有tiles当前的静态网格
     * 一般会在`漫游/物理碰撞支持`场景需要
     */
    get mergeMesh(): Mesh | null {
        if (!this._tilesMergeMesh) {
            this.monitorComputeMergeMesh();

            // 判断是否需要监听和重建bvh
            if (this.rebuildBVHEventsTiles.length === 0 && this.tilesMap.size > 0) {
                for (const tiles of this.tilesMap.values()) {
                    tiles.forEach(_tile => {
                        // 监听 'tiles-load-end' 事件，這是触发 BVH 重建的最佳时机
                        _tile.renderer.addEventListener('tiles-load-end', this.scheduleRebuildFn);

                        this.rebuildBVHEventsTiles.push(_tile);
                    });
                }
            }
        }

        return this._tilesMergeMesh;
    }

    addTiles(tiles: Tiles): Promise<Tiles> {
        return new Promise(resolve => {
            // 设置共享队列(正确确定下载优先级)
            if (!this.parseQueue) {
                this.downloadQueue = tiles.renderer.downloadQueue;
                this.parseQueue = tiles.renderer.parseQueue;
                this.processNodeQueue = tiles.renderer.processNodeQueue;
            } else {
                tiles.renderer.downloadQueue = this.downloadQueue as PriorityQueue;
                tiles.renderer.parseQueue = this.parseQueue as PriorityQueue;
                tiles.renderer.processNodeQueue = this.processNodeQueue as PriorityQueue;
            }

            if (tiles.options.reset2origin) {
                tiles.renderer.addEventListener('load-tile-set', () => {
                    // 调整瓦片的位置和方向,重置回原点
                    this.adjustTilesPositionAndDirection(tiles.renderer);
                });
            }

            tiles.renderer.addEventListener('tiles-load-end', () => {
                this.needRender = true;

                resolve(tiles);
            });

            tiles.renderer.addEventListener('needs-update', () => {
                this.needRender = true;
            });

            let _tiles = this.tilesMap.get(tiles.options.url);
            if (!_tiles || _tiles.length === 0) {
                _tiles = [];
            }
            _tiles.push(tiles);
            this.tilesMap.set(tiles.options.url, _tiles);

            if (this._tilesMergeMesh) {
                this.monitorComputeMergeMesh();

                // 监听 'tiles-load-end' 事件，這是触发 BVH 重建的最佳时机
                tiles.renderer.addEventListener('tiles-load-end', this.scheduleRebuildFn);

                this.rebuildBVHEventsTiles.push(tiles);
            }
        })
    }

    removeTiles(tiles: Tiles) {
        if (!tiles) return;

        const _tiles = this.tilesMap.get(tiles.options.url);

        if (!_tiles || _tiles.length === 0) return;

        const filterTiles = _tiles.filter(_tile => _tile.uuid !== tiles.uuid);

        if (filterTiles.length > 0) {
            this.tilesMap.set(tiles.options.url, filterTiles);
        } else {
            this.tilesMap.delete(tiles.options.url);
        }

        if (this._tilesMergeMesh) {
            tiles.renderer.removeEventListener('tiles-load-end', this.scheduleRebuildFn);

            this.rebuildBVHEventsTiles = this.rebuildBVHEventsTiles.filter(_tile => _tile.uuid !== tiles.uuid);

            this.monitorComputeMergeMesh();
        }

        tiles.dispose();
    }

    resize() {
        for (const tiles of this.tilesMap.values()) {
            tiles.forEach(_tiles => {
                _tiles.renderer.setResolutionFromRenderer(this.camera, this.renderer);
            });
        }
    }

    update() {
        // this.camera.updateMatrixWorld();

        for (const tiles of this.tilesMap.values()) {
            tiles.forEach(tile => tile.update());
        }

        if (!this.needRender) return false;

        this.needRender = false;

        return true;
    }

    /**
     * 重置瓦片的位置和方向回原点
     */
    adjustTilesPositionAndDirection(tiles: TilesRenderer) {
        if (!tiles) {
            return;
        }

        const sphere = new Sphere();
        tiles.getBoundingSphere(sphere);

        const position = sphere.center.clone();
        const distanceToEllipsoidCenter = position.length();

        const surfaceDirection = position.normalize();
        const up = new Vector3(0, 1, 0);
        const rotationToNorthPole = this.rotationBetweenDirections(surfaceDirection, up);

        tiles.group.quaternion.x = rotationToNorthPole.x;
        tiles.group.quaternion.y = rotationToNorthPole.y;
        tiles.group.quaternion.z = rotationToNorthPole.z;
        tiles.group.quaternion.w = rotationToNorthPole.w;

        tiles.group.position.y = -distanceToEllipsoidCenter;
    }

    rotationBetweenDirections(dir1: Vector3, dir2: Vector3) {
        const rotation = new Quaternion();
        const a = new Vector3().crossVectors(dir1, dir2);
        rotation.x = a.x;
        rotation.y = a.y;
        rotation.z = a.z;
        rotation.w = 1 + dir1.clone().dot(dir2);
        rotation.normalize();

        return rotation;
    }

    /**
     * 获取场景中实时的所有Tiles的Mesh
     */
    getAllTileMesh() {
        const meshArray: Mesh[] = []
        for (const tiles of this.tilesMap.values()) {
            tiles.forEach(value => {
                const group = value.group;
                group.traverseVisible((child) => {
                    if (child.isMesh) {
                        meshArray.push(child as Mesh);
                    }
                });
            });
        }

        return meshArray;
    }

    /**
     * 调度 BVH 重建（this.monitorComputeMergeMesh），核心是防抖
     * 防止在摄影机连续移动导致瓦片频繁载入時，过度频繁地执行高耗能的 BVH 计算
     */
    public scheduleRebuild(): void {
        // 如果已經有一個計時器在等待，则清除它
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        // 设置一个新的计时器，在延迟时间后执行重建
        this.debounceTimeout = setTimeout(() => {
            this.monitorComputeMergeMesh();
        }, this.debounceDelay);
    }

    /**
     * 监听tiles变化并实时计算合并的静态网格
     */
    protected monitorComputeMergeMesh() {
        if (this._tilesMergeMesh) {
            this.scene.remove(this._tilesMergeMesh);
            this._tilesMergeMesh.geometry.dispose();
            (this._tilesMergeMesh.material as Material).dispose();
            this._tilesMergeMesh = null;
        }

        const tileMeshes = this.getAllTileMesh();
        if (tileMeshes.length === 0) return;

        const generator = new StaticGeometryGenerator([...tileMeshes]);
        generator.attributes = ['position'];
        const geometry = generator.generate();
        // geometry.computeBoundsTree({
        //     // 使用 CENTER 策略在很多情況下性能更好
        //     strategy: CENTER
        // });

        geometry.boundsTree = new MeshBVH(geometry);

        this._tilesMergeMesh = new Mesh(geometry);
        this._tilesMergeMesh.name = "astral-3d-tiles-merge-mesh";
        this._tilesMergeMesh.visible = false;
        this._tilesMergeMesh.ignore = true;

        this.scene.add(this._tilesMergeMesh);
    }

    dispose() {
        if (this._tilesMergeMesh) {
            this.scene.remove(this._tilesMergeMesh);
            this._tilesMergeMesh.geometry.dispose();
            (this._tilesMergeMesh.material as Material).dispose();
            this._tilesMergeMesh = null;

            this.rebuildBVHEventsTiles.forEach(tiles => {
                tiles.renderer.removeEventListener('tiles-load-end', this.scheduleRebuildFn);
            })

            this.rebuildBVHEventsTiles.length = 0;
        }

        for (const tiles of this.tilesMap.values()) {
            tiles.forEach(tile => tile.dispose());
        }
        this.tilesMap.clear();

        this.downloadQueue = null;
        this.parseQueue = null;
        this.processNodeQueue = null;
    }
}