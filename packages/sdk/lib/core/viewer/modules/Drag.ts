import * as THREE from "three";
import { DragControls } from '#/core/controls/DragControls.js';
import { useDispatchSignal } from "#/hooks";
import Viewer from "../Viewer";
import App from "#/core/app/App";
import { Measure } from "#/core/tools";

// dragControls 绑定函数
let dragStartFn, dragFn, dragEndFn, clickblankFn;

class Drag {
    protected _dragObjects: THREE.Object3D[] = []; // 拖拽对象
    public dragControls: any;
    private onDownPosition: { x: number; y: number } = { x: -1, y: -1 };

    public viewer: Viewer;
    public measureInstance: Measure | null = null;
    public isDragging = false;

    constructor(viewer: Viewer) {
        this.viewer = viewer;

        // 物体拖拽控制器
        this.dragControls = new DragControls(this._dragObjects, viewer.camera, viewer.renderer.domElement);
        this.dragControls.deactivate(); // 默认禁用
        dragStartFn = this.dragControlsStart.bind(this);
        this.dragControls.addEventListener("dragstart", dragStartFn);
        dragFn = this.drag.bind(this);
        this.dragControls.addEventListener("drag", dragFn);
        dragEndFn = this.dragControlsEnd.bind(this);
        this.dragControls.addEventListener("dragend", dragEndFn);
        // 点击可拖拽物体之外
        clickblankFn = this.clickblank.bind(this);
        this.dragControls.addEventListener("clickblank", clickblankFn);
    }

    set domElement(element: HTMLElement) {
        this.dragControls.setDomElement(element);
    }

    setMeasureInstance(measureInstance: Measure) {
        this.measureInstance = measureInstance;
    }

    setDragObjects(objects: THREE.Object3D[], type: "eq" | "push" | "remove" = "eq") {
        // 当前拖拽对象为空时加入对象需激活控制器
        if (this._dragObjects.length === 0) {
            if (objects.length > 0) {
                this.dragControls.activate();
            }

            this._dragObjects = objects;
        } else {
            // 当前拖拽对象不为空时
            if (type === "eq") {
                // 是清空拖拽对象的设置，则禁用控制器
                if (objects.length === 0) {
                    this.dragControls.deactivate();
                }

                this._dragObjects = objects;
            } else if (type === "push") {
                this._dragObjects.push(...objects);
            } else if (type === "remove") {
                this._dragObjects = this._dragObjects.filter((item) => !objects.includes(item));
            }
        }

        this.dragControls.setObjects(this._dragObjects)
    }

    // 拖拽开始
    dragControlsStart(e) {
        // 右键拖拽不响应
        if (e.e.button === 2 || !e.object.userData.type || !e.object.visible || !App.sceneHelpers.visible) return;

        e.e.preventDefault();

        // 拖拽时禁用其他控制器
        this.viewer.modules.controls.enabled = false;
        this.viewer.modules.transformControls && (this.viewer.modules.transformControls.enabled = false);

        this.isDragging = true;

        // 记录拖拽按下的位置和对象
        this.onDownPosition = { x: e.e.clientX, y: e.e.clientY };

        switch (e.object.userData.type) {
            case "measure-marker":
                this.measureInstance?.redraw(e.object);
                break;
        }
    }

    // 拖拽中
    drag(e) {
        useDispatchSignal("objectChanged", e.object)
    }

    // 拖拽结束
    dragControlsEnd(e) {
        // 右键拖拽不响应
        if (e.e.button === 2 || !e.object.visible || !App.sceneHelpers.visible) return;

        // 拖拽结束启用其他控制器
        this.viewer.modules.controls.enabled = true;
        this.viewer.modules.transformControls && (this.viewer.modules.transformControls.enabled = true);

        this.isDragging = false;

        if (!e.object.userData.type) return;

        // 判断位置是否有变化,没有变化则为点击
        if (this.onDownPosition.x === e.e.clientX && this.onDownPosition.y === e.e.clientY) {
            if (e.object.userData.onClick) {
                e.object.userData.onClick(e);
            }
        }

        switch (e.object.userData.type) {
            case "measure-marker":
                this.measureInstance?.redrawComplete();
                break;
        }
    }

    // 点击可拖拽物体之外
    clickblank(e) {
        if (e.e.button === 2) return;
    }

    dispose() {
        this._dragObjects = [];

        this.dragControls.removeEventListener("dragstart", dragStartFn);
        this.dragControls.removeEventListener("dragend", dragEndFn);
        this.dragControls.dispose();
    }
}

export { Drag };