import { MathUtils, OrthographicCamera, PerspectiveCamera, Scene, WebGLRenderer, Object3D } from "three";
import Viewer from "#/core/viewer/Viewer";

interface IMiniMapOptions {
    mapSize: number,  // 决定了摄像机看到的内容大小, mapSize * mapSize 大小内容
    mapRenderSize: number,  // 决定了小地图2D平面的大小
    followTarget: Object3D, // 小地图画面主要跟随对象
    isShow: boolean // 是否显示小地图
}

class MiniMap {
    _miniMapCamera: OrthographicCamera | PerspectiveCamera | null = null;
    _miniMapRenderer: WebGLRenderer | null = null;
    _followTarget: Object3D;

    private scene: Scene;
    private sceneHelpers: Scene;
    private mapRenderSize: number;
    // @ts-ignore
    public dom: HTMLDivElement;

    isShow: boolean = false;

    constructor(viewer: Viewer, options: IMiniMapOptions) {
        this.scene = viewer.scene;
        this.sceneHelpers = viewer.sceneHelpers;
        this.mapRenderSize = options.mapRenderSize;
        this._followTarget = options.followTarget;
        this.isShow = options.isShow;

        if (!this.scene) {
            throw new Error("scene不能为空");
        }
        if (!this._followTarget) {
            throw new Error("target不能为空，表示小地图画面主要跟随对象");
        }

        this.dom = this.createDomElement();
        viewer.container.appendChild(this.dom);

        // 初始化小地图相机
        this._miniMapCamera = new OrthographicCamera(
            -options.mapSize / 2,
            options.mapSize / 2,
            options.mapSize / 2,
            -options.mapSize / 2,
            1, 100 * 1000
        );

        // 更新地图相机位置和朝向
        this.updateCamera();
    }

    createDomElement() {
        // 初始化小地图渲染器
        const mapRenderer = new WebGLRenderer({ alpha: true });
        mapRenderer.setSize(this.mapRenderSize, this.mapRenderSize);
        // mapRenderer.setClearColor(0x7d684f);
        mapRenderer.shadowMap.enabled = false;
        mapRenderer.autoClear = false;
        this._miniMapRenderer = mapRenderer;

        const pDiv = document.createElement("div");
        pDiv.id = "es-3d-mini-map";
        pDiv.style.position = "absolute";
        pDiv.style.right = "10px";
        pDiv.style.top = "10px";
        pDiv.style.zIndex = "1001";
        pDiv.style.border = "1px solid #FFF";
        pDiv.style.background = "rgba(0, 0, 0, 0.40)";
        pDiv.style.width = this.mapRenderSize - 100 + "px";
        pDiv.style.height = this.mapRenderSize - 100 + "px";
        pDiv.style.overflow = "hidden";
        pDiv.style.display = this.isShow ? "block" : "none";

        mapRenderer.domElement.style.transform = `rotateZ(0deg)`;
        mapRenderer.domElement.style.width = this.mapRenderSize + "px";
        mapRenderer.domElement.style.height = this.mapRenderSize + "px";
        mapRenderer.domElement.style.position = "absolute";
        mapRenderer.domElement.style.left = "-50px";
        mapRenderer.domElement.style.top = "-50px";

        pDiv.appendChild(mapRenderer.domElement);

        return pDiv;
    }

    open() {
        this.dom.style.display = "block";
        this.isShow = true;
    }

    close() {
        this.dom.style.display = "none";
        this.isShow = false;
    }

    updateCamera() {
        // 更新小地图css旋转角度，与玩家同步
        let targetRotateY = MathUtils.radToDeg(this._followTarget.rotation.y - Math.PI);
        (this._miniMapRenderer as WebGLRenderer).domElement.style.transform = `rotateZ(${targetRotateY}deg)`;

        // 更新地图相机位置和朝向
        let targetPos = this._followTarget.position;
        (this._miniMapCamera as OrthographicCamera).position.set(
            targetPos.x,
            targetPos.y + 10,
            targetPos.z
        );
        (this._miniMapCamera as OrthographicCamera).lookAt(targetPos.x, 2, targetPos.z);
    }

    update() {
        // 更新地图相机位置和朝向
        this.updateCamera();

        const renderer = this._miniMapRenderer as WebGLRenderer;

        renderer.autoClear = false;

        // 渲染小地图
        renderer.render(this.scene, this._miniMapCamera as OrthographicCamera);

        renderer.render(this.sceneHelpers, this._miniMapCamera as OrthographicCamera);

        renderer.autoClear = true;
    }
}

export { MiniMap }