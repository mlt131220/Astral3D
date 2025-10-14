import {
    Box3,
    Vector3,
    Mesh,
    MeshBasicMaterial,
    Vector2,
    Raycaster,
    Group,
    LineSegments,
    LineBasicMaterial,
    Plane,
    PlaneGeometry,
    BackSide,
    BufferGeometry,
    Object3D
} from "three";
import { useAddSignal, useDispatchSignal, useRemoveSignal } from "#/hooks";
import { isGroup } from "#/utils";
import Viewer from "#/core/viewer/Viewer";
import App from "#/core/app/App";

let objectSelectedFn;

/**
 * 盒剖切
 * @param viewer
 * @param controls
 */
class ClippedEdgesBox {
    // 最小剖切盒宽度
    static MIN_WIDTH = 0.05;

    private viewer: Viewer;
    protected controls;

    public isOpen: boolean = false;
    protected sectionBox?: Box3;
    protected lastSelected: Object3D | undefined = undefined;

    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.controls = viewer.modules.controls;

        // 开启模型对象的局部剪裁平面功能. 如果不设置为true，设置剪裁平面的模型不会被剪裁
        this.viewer.renderer.localClippingEnabled = true;

        objectSelectedFn = this.objectSelected.bind(this);
    }

    get domElement() {
        return this.viewer.renderer.domElement;
    }

    /**
     * 如果在构造函数中没有分配sectionBox，那么在这里设置它
     */
    protected setSectionBox() {
        this.sectionBox = new Box3();

        if (!App.selected) {
            this.lastSelected = undefined;
            this.sectionBox.expandByObject(this.viewer.scene)
        } else {
            this.lastSelected = App.selected;
            this.sectionBox?.expandByObject(App.selected)
        }
    }

    /**
     * 切换选中模型
     */
    objectSelected() {
        if (!this.isOpen) return;

        this.reset();
    }

    /**
     * 开始剖切
     */
    open() {
        this.initSectionBox();
        this.addMouseListener();
        this.isOpen = true;

        useAddSignal("objectSelected", objectSelectedFn);
        useDispatchSignal("sceneGraphChanged");
    }

    /**
     * 关闭剖切
     */
    close() {
        this.isOpen = false;
        this.removeMouseListener();
        this.clearSectionBox();

        useRemoveSignal("objectSelected", objectSelectedFn);
        useDispatchSignal("sceneGraphChanged")
    }

    /**
     * 重置剖切
     */
    reset() {
        this.close();
        this.open();

        useDispatchSignal("sceneGraphChanged")
    }

    dispose() {
        if (this.isOpen) {
            this.close();
        }

        objectSelectedFn = undefined;
    }

    // --------------- 剖切盒 --------------------

    protected boxMin: Vector3 = new Vector3(); // 剖切盒最小点
    protected boxMax: Vector3 = new Vector3(); // 剖切盒最大点
    protected group: Group = new Group(); // 包含section的所有对象
    protected planes: Array<Plane> = []; // 切面
    protected vertices = [
        new Vector3(), new Vector3(), new Vector3(), new Vector3(), // 顶部有4个顶点
        new Vector3(), new Vector3(), new Vector3(), new Vector3() // 底部有4个顶点
    ];

    protected faces: Array<BoxFace> = [];
    protected lines: Array<BoxLine> = [];

    /**
     * 初始化剖切盒
     */
    protected initSectionBox() {
        this.setSectionBox();

        // boxMin 与 boxMax 应增加内边距以免贴合
        this.boxMin = (this.sectionBox as Box3).min.sub(new Vector3(0.05, 0.05, 0.05));
        this.boxMax = (this.sectionBox as Box3).max.add(new Vector3(0.05, 0.05, 0.05));
        this.group = new Group();
        this.group.name = "clippedEdgesBox";
        this.group.ignore = true;
        this.initPlanes();
        this.initOrUpdateVertices();
        this.initOrUpdateFaces();
        this.initOrUpdateLines();
        this.viewer.scene.add(this.group);
    }

    /**
     * 初始化剖切盒的六面
     */
    protected initPlanes() {
        this.planes = [];
        this.planes.push(
            new Plane(new Vector3(0, -1, 0), this.boxMax.y), // up
            new Plane(new Vector3(0, 1, 0), -this.boxMin.y), // down
            new Plane(new Vector3(1, 0, 0), -this.boxMin.x), // left
            new Plane(new Vector3(-1, 0, 0), this.boxMax.x), // right
            new Plane(new Vector3(0, 0, -1), this.boxMax.z), // front
            new Plane(new Vector3(0, 0, 1), -this.boxMin.z) // back
        );

        const setChildClippingPlanes = (child) => {
            if (["Mesh", "LineSegments"].includes(child.type)) {
                child.material.clippingPlanes = this.planes;
                child.material.clipIntersection = false;
            }
        }

        if (!this.lastSelected) {
            this.viewer.scene.traverseVisible(c => {
                setChildClippingPlanes(c)
            })
        } else {
            if (isGroup(this.lastSelected)) {
                App.traverseMeshToArr(this.lastSelected).forEach(child => {
                    setChildClippingPlanes(child)
                })
            } else {
                setChildClippingPlanes(this.lastSelected)
            }
        }
    }

    protected updatePlanes() {
        this.planes[0].constant = this.boxMax.y;
        this.planes[1].constant = -this.boxMin.y;
        this.planes[2].constant = -this.boxMin.x;
        this.planes[3].constant = this.boxMax.x;
        this.planes[4].constant = this.boxMax.z;
        this.planes[5].constant = -this.boxMin.z;
    }

    /**
     * 初始化或更新剖切盒的8个顶点
     */
    protected initOrUpdateVertices() {
        this.vertices[0].set(this.boxMin.x, this.boxMax.y, this.boxMin.z); // 顶部的四个顶点
        this.vertices[1].set(this.boxMax.x, this.boxMax.y, this.boxMin.z);
        this.vertices[2].set(this.boxMax.x, this.boxMax.y, this.boxMax.z);
        this.vertices[3].set(this.boxMin.x, this.boxMax.y, this.boxMax.z);
        this.vertices[4].set(this.boxMin.x, this.boxMin.y, this.boxMin.z); // 底部的四个顶点
        this.vertices[5].set(this.boxMax.x, this.boxMin.y, this.boxMin.z);
        this.vertices[6].set(this.boxMax.x, this.boxMin.y, this.boxMax.z);
        this.vertices[7].set(this.boxMin.x, this.boxMin.y, this.boxMax.z);
    }

    /**
     * 初始化或更新剖切盒的6个面
     */
    protected initOrUpdateFaces() {
        const v = this.vertices;
        if (!this.faces || this.faces.length === 0) {
            this.faces = [];
            this.faces.push(
                new BoxFace("yUp", [v[0], v[1], v[2], v[3]]), // up
                new BoxFace("yDown", [v[4], v[7], v[6], v[5]]), // down
                new BoxFace("xLeft", [v[0], v[3], v[7], v[4]]), // left
                new BoxFace("xRight", [v[1], v[5], v[6], v[2]]), // right
                new BoxFace("zFront", [v[2], v[6], v[7], v[3]]), // front
                new BoxFace("zBack", [v[0], v[4], v[5], v[1]]) // back
            );
            this.group.add(...this.faces);
            this.faces.forEach(face => {
                this.group.add(face.backFace);
            });
        } else {
            const f = this.faces;
            f[0].setFromPoints([v[0], v[1], v[2], v[3]]);
            f[1].setFromPoints([v[4], v[7], v[6], v[5]]);
            f[2].setFromPoints([v[0], v[3], v[7], v[4]]);
            f[3].setFromPoints([v[1], v[5], v[6], v[2]]);
            f[4].setFromPoints([v[2], v[6], v[7], v[3]]);
            f[5].setFromPoints([v[0], v[4], v[5], v[1]]);
        }
    }

    /**
     * 初始化或更新剖切盒的12条边
     */
    protected initOrUpdateLines() {
        const v = this.vertices;
        if (!this.lines || this.lines.length === 0) {
            const f = this.faces;
            if (!f) {
                throw Error("需要先初始化面!");
            }
            this.lines = [];
            this.lines.push(
                new BoxLine([v[0], v[1]], [f[0], f[5]]),
                new BoxLine([v[1], v[2]], [f[0], f[3]]),
                new BoxLine([v[2], v[3]], [f[0], f[4]]),
                new BoxLine([v[3], v[0]], [f[0], f[2]]),
                new BoxLine([v[4], v[5]], [f[1], f[5]]),
                new BoxLine([v[5], v[6]], [f[1], f[3]]),
                new BoxLine([v[6], v[7]], [f[1], f[4]]),
                new BoxLine([v[7], v[4]], [f[1], f[2]]),
                new BoxLine([v[0], v[4]], [f[2], f[5]]),
                new BoxLine([v[1], v[5]], [f[3], f[5]]),
                new BoxLine([v[2], v[6]], [f[3], f[4]]),
                new BoxLine([v[3], v[7]], [f[2], f[4]])
            );
            this.group.add(...this.lines);
        } else {
            let i = 0;
            this.lines[i++].setFromPoints([v[0], v[1]]);
            this.lines[i++].setFromPoints([v[1], v[2]]);
            this.lines[i++].setFromPoints([v[2], v[3]]);
            this.lines[i++].setFromPoints([v[3], v[0]]);
            this.lines[i++].setFromPoints([v[4], v[5]]);
            this.lines[i++].setFromPoints([v[5], v[6]]);
            this.lines[i++].setFromPoints([v[6], v[7]]);
            this.lines[i++].setFromPoints([v[7], v[4]]);
            this.lines[i++].setFromPoints([v[0], v[4]]);
            this.lines[i++].setFromPoints([v[1], v[5]]);
            this.lines[i++].setFromPoints([v[2], v[6]]);
            this.lines[i++].setFromPoints([v[3], v[7]]);
        }
    }

    /**
     * 清除剖切盒
     */
    protected clearSectionBox() {
        this.viewer.scene.remove(this.group);
        this.domElement.style.cursor = "";
        this.faces = [];
        this.lines = [];

        const setChildClippingPlanes = (child) => {
            if (["Mesh", "LineSegments"].includes(child.type)) {
                child.material.clippingPlanes = [];
            }
        }

        if (!this.lastSelected) {
            this.viewer.scene.traverseVisible(c => {
                setChildClippingPlanes(c);
            })
        } else {
            if (isGroup(this.lastSelected)) {
                App.traverseMeshToArr(this.lastSelected).forEach(child => {
                    setChildClippingPlanes(child)
                })
            } else {
                setChildClippingPlanes(this.lastSelected)
            }
        }
    }

    // ------------------- 指针事件 -----------------------

    protected raycaster: Raycaster = new Raycaster();
    protected mousePosition: Vector2 = new Vector2();
    // 鼠标悬停的面激活
    protected activeFace: BoxFace | null = null;

    private addMouseListener() {
        this.domElement.addEventListener("pointermove", this.onMouseMove);
        this.domElement.addEventListener("pointerdown", this.onMouseDown);
    }

    private removeMouseListener() {
        this.domElement.removeEventListener("pointermove", this.onMouseMove);
        this.domElement.removeEventListener("pointerdown", this.onMouseDown);
    }

    /**
     * 转换鼠标坐标，并更新光线投射
     */
    protected updateMouseAndRay(event: MouseEvent) {
        this.mousePosition.setX((event.offsetX / this.domElement.offsetWidth) * 2 - 1);
        this.mousePosition.setY(-(event.offsetY / this.domElement.offsetHeight) * 2 + 1);
        this.raycaster.setFromCamera(this.mousePosition, this.viewer.camera);
    }

    /**
     * 处理鼠标移动事件，正确高亮相应的面/线
     */
    protected onMouseMove = (event: MouseEvent) => {
        this.updateMouseAndRay(event);
        const intersects = this.raycaster.intersectObjects(this.faces); // 鼠标和面相交
        if (intersects.length) {
            this.domElement.style.cursor = "pointer";
            const face = intersects[0].object as BoxFace;
            if (face !== this.activeFace) {
                if (this.activeFace) {
                    this.activeFace.setActive(false);
                }
                face.setActive(true);
                this.activeFace = face;
            }
        } else {
            if (this.activeFace) {
                this.activeFace.setActive(false);
                this.activeFace = null;
                this.domElement.style.cursor = "auto";
            }
        }
    };

    /**
     * 处理鼠标按下事件，开始使用左键拖动一个面
     */
    protected onMouseDown = (event: MouseEvent) => {
        const isLeftButton = event.button === 0;

        if (this.activeFace && isLeftButton) {
            this.updateMouseAndRay(event);
            const intersects = this.raycaster.intersectObjects(this.faces);
            if (intersects.length) {
                const face = intersects[0].object as BoxFace;
                const axis = face.axis;
                const point = intersects[0].point;
                this.drag.start(axis, point);
            }
        }
    };

    /**
     * 拖动对象，用于处理面裁剪操作
     */
    protected drag = {
        axis: "", // 要拖动的6轴之一
        point: new Vector3(), // 记录拖动点的位置
        ground: new Mesh(new PlaneGeometry(100000, 100000), new MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false
        })),
        start: (axis: string, point: Vector3) => {
            this.drag.axis = axis;
            this.drag.point = point;
            this.drag.initGround();
            this.controls.enabled = false;
            this.domElement.style.cursor = "move";

            this.domElement.removeEventListener("pointermove", this.onMouseMove);
            this.domElement.addEventListener("pointermove", this.drag.mousemove);
            this.domElement.addEventListener("pointerup", this.drag.mouseup);
        },
        end: () => {
            this.viewer.scene.remove(this.drag.ground);
            this.controls.enabled = true;
            this.domElement.removeEventListener("pointermove", this.drag.mousemove);
            this.domElement.removeEventListener("pointerup", this.drag.mouseup);
            this.domElement.addEventListener("pointermove", this.onMouseMove);
        },
        mousemove: (event: MouseEvent) => {
            this.updateMouseAndRay(event);
            const intersects = this.raycaster.intersectObject(this.drag.ground); // 鼠标与拖动地面的相交情况
            if (intersects.length) {
                this.drag.updateSectionBox(intersects[0].point);
            }
        },
        mouseup: () => {
            this.drag.end();
        },
        // 拖动时初始化参考平面，可以是XY, YZ, ZX平面
        initGround: () => {
            const normals: any = {
                xLeft: new Vector3(-1, 0, 0),
                xRight: new Vector3(1, 0, 0),
                yDown: new Vector3(0, -1, 0),
                yUp: new Vector3(0, 1, 0),
                zBack: new Vector3(0, 0, -1),
                zFront: new Vector3(0, 0, 1)
            };
            if (["xLeft", "xRight"].includes(this.drag.axis)) {
                this.drag.point.setX(0);
            } else if (["yDown", "yUp"].includes(this.drag.axis)) {
                this.drag.point.setY(0);
            } else if (["zBack", "zFront"].includes(this.drag.axis)) {
                this.drag.point.setZ(0);
            }
            this.drag.ground.position.copy(this.drag.point);
            const newNormal = this.viewer.camera.position.clone()
                .sub(this.viewer.camera.position.clone().projectOnVector(normals[this.drag.axis]))
                .add(this.drag.point); // 得到平面的法线
            this.drag.ground.lookAt(newNormal);
            this.viewer.scene.add(this.drag.ground);
        },
        // 更新裁剪盒子的位置
        updateSectionBox: (point: Vector3) => {
            const minSize = ClippedEdgesBox.MIN_WIDTH; // 截面框的最小尺寸
            switch (this.drag.axis) {
                case "yUp": // up
                    this.boxMax.setY(Math.max(this.boxMin.y + minSize, point.y));
                    break;
                case "yDown": // down
                    this.boxMin.setY(Math.min(this.boxMax.y - minSize, point.y));
                    break;
                case "xLeft": // left
                    this.boxMin.setX(Math.min(this.boxMax.x - minSize, point.x));
                    break;
                case "xRight": // right
                    this.boxMax.setX(Math.max(this.boxMin.x + minSize, point.x));
                    break;
                case "zFront": // front
                    this.boxMax.setZ(Math.max(this.boxMin.z + minSize, point.z));
                    break;
                case "zBack": // back
                    this.boxMin.setZ(Math.min(this.boxMax.z - minSize, point.z));
                    break;
            }

            // 更新剖切盒的平面、顶点、面和线
            this.updatePlanes();
            this.initOrUpdateVertices();
            this.initOrUpdateFaces();
            this.initOrUpdateLines();

            useDispatchSignal("sceneGraphChanged");
        }
    };
}

/**
 * 剖切盒的BoxLine
 */
class BoxLine extends LineSegments {
    private normalMaterial = new LineBasicMaterial({ color: 0x2ee3dc }); // 0x2ee3dc，线的正常颜色(原颜色:0xe1f2fb)
    private activeMaterial = new LineBasicMaterial({ color: 0x00fdec }); // 0x00fdec，线的激活颜色(原始颜色:0x00ffff)

    /**
     * @param vertices 一条直线上的两点
     * @param faces 相对于一条线的两个面
     */
    constructor(vertices: Array<Vector3>, faces: Array<BoxFace>) {
        super();
        faces.forEach(face => face.lines.push(this)); // 保存面与线之间的关系
        this.geometry = new BufferGeometry();
        this.geometry.setFromPoints(vertices);
        this.material = this.normalMaterial;
    }

    /**
     * 更新 geometry
     */
    setFromPoints(vertices: Vector3[]) {
        this.geometry.setFromPoints(vertices);
    }

    /**
     * 设置为活动或非活动状态
     * @param isActive
     */
    setActive(isActive: boolean) {
        this.material = isActive ? this.activeMaterial : this.normalMaterial;
    }
}

/**
 * 剖切盒的BoxFace
 */
class BoxFace extends Mesh {
    axis: string;
    lines: Array<BoxLine> = []; // 4条线相对于一个面
    backFace: Mesh; // 背面:face的背面，用于显示

    /**
     * @param axis 面的轴
     * @param vertices 面的四个点
     */
    constructor(axis: string, vertices: Array<Vector3>) {
        super();
        this.axis = axis;
        this.lines = [];
        this.geometry = new BufferGeometry();
        this.geometry.setFromPoints(vertices);
        this.geometry.setIndex([0, 3, 2, 0, 2, 1]);
        this.geometry.computeVertexNormals();
        this.material = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
        const backMaterial = new MeshBasicMaterial({ color: 0x2ee3dc, transparent: true, opacity: 0.3, side: BackSide });
        this.backFace = new Mesh(this.geometry, backMaterial);
    }

    /**
     * 更新geometry
     */
    setFromPoints(vertices: Vector3[]) {
        this.geometry.setFromPoints(vertices);
    }

    /**
     * 设置为活动或非活动状态
     * @param isActive
     */
    setActive(isActive: boolean) {
        this.lines.forEach(line => {
            line.setActive(isActive)
        });
    }
}

export { ClippedEdgesBox };