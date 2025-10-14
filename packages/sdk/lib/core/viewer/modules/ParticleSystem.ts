import * as THREE from 'three';
import System, * as Particle from '#/core/libs/three-nebula';
import { useAddSignal, useDispatchSignal, useRemoveSignal } from "#/hooks";
import * as BasicObject3D from "#/core/built-in/assets/BasicObject3D";
import ParticleEmitter from "#/core/objects/ParticleEmitter";
import { isParticleObject } from "#/utils";
import Viewer from "../Viewer";
import App from "#/core/app/App";
import Preview from "#/core/preview/Preview.ts";

let _objectRemovedFn, _objectAddedFn, _bodyChangedFn, _addEmitterFn, _emitterAdd2Fn;

class ParticleSystem {
  private viewer: Viewer | Preview;

  // 存储所有粒子的组
  particlesGroup: THREE.Group;

  spriteRenderer: Particle.SpriteRenderer;
  meshRenderer: Particle.MeshRenderer;
  spriteSystem: System;
  meshSystem: System;

  /**
   * 场景中粒子body类型为Point的对象
   */
  static PointBody: THREE.Points = (function () {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([0, 0, 0]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({ size: 0.1, color: 0xff0000 });

    return new THREE.Points(geometry, material);
  })();

  /**
   * 场景中所有粒子用到的Sprite | Mesh，统一管理
   * key: 粒子ParticleEmitter的uuid，value: 粒子的body对象
   */
  static Body3DMap: Map<string, THREE.Sprite | THREE.Mesh> = new Map();

  constructor(viewer: Viewer | Preview) {
    this.viewer = viewer;

    this.particlesGroup = new THREE.Group();
    this.particlesGroup.name = 'astral-particles-group';
    // 不在场景树中显示此组
    this.particlesGroup.ignore = true;
    this.viewer.scene.add(this.particlesGroup);

    this.spriteSystem = new System();
    this.spriteSystem.name = 'spriteSystem';
    this.meshSystem = new System();
    this.meshSystem.name = 'meshSystem';
    this.spriteRenderer = new Particle.SpriteRenderer(this.particlesGroup, THREE);
    this.meshRenderer = new Particle.MeshRenderer(this.particlesGroup, THREE);
    this.spriteSystem.addRenderer(this.spriteRenderer);
    this.meshSystem.addRenderer(this.meshRenderer);

    this.initEvent();
  }

  get needsUpdate() {
    return this.spriteSystem.emitters.length > 0 || this.meshSystem.emitters.length > 0;
  }

  initEvent() {
    _objectRemovedFn = this.handleObjectRemoved.bind(this);
    useAddSignal("objectRemoved", _objectRemovedFn);
    _objectAddedFn = this.handleObjectAdded.bind(this);
    useAddSignal("objectAdded", _objectAddedFn);
    _bodyChangedFn = this.handleParticleBodyChanged.bind(this);
    useAddSignal("particleBodyChanged", _bodyChangedFn);
    _emitterAdd2Fn = this.handleEmitterAdd.bind(this);
    useAddSignal("emitterAdd2ParticleSystem", _emitterAdd2Fn);

    _addEmitterFn = this.handleAddEmitter.bind(this);
    this.spriteSystem.eventDispatcher.addEventListener('EMITTER_ADDED', _addEmitterFn)
    this.meshSystem.eventDispatcher.addEventListener('EMITTER_ADDED', _addEmitterFn)
  }

  handleAddEmitter(emitter: Particle.Emitter) {
    useDispatchSignal('particleSystemAddEmitter', emitter);
  }

  /**
   * 监听对象移除
   */
  handleObjectRemoved(object) {
    if (!object || object.type !== "Particle") return;

    if (!object.emitter) return;

    const emitterJSON = object.toJSON().object.emitter;

    if (this.spriteSystem.emitters.includes(object.emitter)) {
      this.spriteSystem.removeEmitter(object.emitter);
    } else {
      this.meshSystem.removeEmitter(object.emitter);
    }

    object.dispose();

    object.emitter = emitterJSON;
  }

  /**
   * 监听对象添加
   * @description 主要应用于对象添加的redo命令
   */
  handleObjectAdded(object) {
    if (!isParticleObject(object)) return;

    if (object.emitter.parent) return;

    object.emitter = ParticleEmitter.fromJSON({
      uuid: object.uuid,
      type: object.type,
      name: object.name,
      emitter: object.emitter,
      children: []
    }).emitter;
    // 重新初始化事件，不然粒子无法选中
    object.initEvent();
  }

  /**
   * 监听粒子body对象改变
   */
  handleParticleBodyChanged(data: IParticle.Config['init']['body'], object3D: THREE.Texture | string | THREE.Mesh, isObjectChange = false, done = (_data: IParticle.Config['init']['body']) => { }) {
    if (!object3D || !data?.body) return;

    const selected = App.selected;
    if (!selected || !(selected instanceof ParticleEmitter)) return;

    const setBody3D = (body3D: THREE.Sprite | THREE.Mesh) => {
      // if (ParticleSystem.Body3DMap.has(selected.uuid)) {
      //   const oldBody3D = ParticleSystem.Body3DMap.get(selected.uuid);
      //   if (oldBody3D && oldBody3D !== body3D) {
      //       if (oldBody3D.material) {
      //           if (Array.isArray(oldBody3D.material)) {
      //               oldBody3D.material.forEach(m => m.dispose());
      //           } else {
      //               oldBody3D.material.dispose();
      //           }
      //       }
      //       oldBody3D.removeFromParent();
      //   }
      //   ParticleSystem.Body3DMap.delete(selected.uuid);
      // }

      ParticleSystem.Body3DMap.set(selected.uuid, body3D);
    }

    const emitter = selected.emitter as Particle.Emitter;
    const initializer = emitter.initializers.find((item) => item.type === "Body");
    // 如果body内的对象未变更直接修改基础属性并返回
    if (initializer && !isObjectChange) {
      initializer.isEnabled = data.isEnabled;
      done(data);
      return;
    }

    if (this.spriteSystem.emitters.includes(emitter)) {
      this.spriteSystem.removeEmitter(emitter);
    } else {
      this.meshSystem.removeEmitter(emitter);
    }

    // 不重新实例化，直接更新初始化器的body属性
    if (!initializer) {
      switch (data.body.type) {
        case "Sprite":
          console.log(111);
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: object3D as THREE.Texture,
            color: 0xffffff,
            //blending: THREE.AdditiveBlending,
            //fog: true,
          }));
          emitter.addInitializer(new Particle.Body(sprite, null, null, data.isEnabled));
          setBody3D(sprite);

          this.spriteSystem.addEmitter(emitter);

          done(Object.assign(data, { uuid: sprite.uuid }));
          break;
        case "Mesh":
          let mesh: THREE.Mesh;
          if (typeof object3D === "string") {
            // 首字母需要大写
            const _objectMethod = object3D.charAt(0).toUpperCase() + object3D.slice(1);
            if (BasicObject3D[_objectMethod]) {
              mesh = BasicObject3D[_objectMethod]();
            } else {
              mesh = BasicObject3D.Box();
            }
          } else {
            mesh = object3D as THREE.Mesh;
          }

          emitter.addInitializer(new Particle.Body(mesh, null, null, data.isEnabled));
          setBody3D(mesh);

          this.meshSystem.addEmitter(emitter);

          done(Object.assign(data, { uuid: null }));
          break;
        case "Point":
          emitter.addInitializer(new Particle.Body(ParticleSystem.PointBody.clone(), null, null, data.isEnabled));

          this.meshSystem.addEmitter(emitter);
          done(Object.assign(data, { uuid: null }));
          break;
      }
    } else {
      switch (data.body.type) {
        case "Sprite":
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: object3D as THREE.Texture,
            color: 0xffffff,
            //blending: THREE.AdditiveBlending,
            //fog: true,
          }));
          initializer.body.items = [sprite];
          setBody3D(sprite);

          this.spriteSystem.addEmitter(emitter);

          done(Object.assign(data, { uuid: sprite.uuid }));
          break;
        case "Mesh":
          let mesh: THREE.Mesh;
          if (typeof object3D === "string") {
            // 首字母需要大写
            const _objectMethod = object3D.charAt(0).toUpperCase() + object3D.slice(1);
            if (BasicObject3D[_objectMethod]) {
              mesh = BasicObject3D[_objectMethod]();
            } else {
              mesh = BasicObject3D.Box();
            }
          } else {
            mesh = object3D as THREE.Mesh;
          }

          initializer.body.items = [mesh];
          setBody3D(mesh);

          this.meshSystem.addEmitter(emitter);

          done(Object.assign(data, { uuid: null }));
          break;
        case "Point":
          initializer.body.items = [ParticleSystem.PointBody.clone()];

          this.meshSystem.addEmitter(emitter);
          done(Object.assign(data, { uuid: null }));
          break;
      }
    }
  }

  /**
   * 监听添加Emitter
   */
  handleEmitterAdd(emitter: Particle.Emitter, system = "spriteSystem") {
    this[system].addEmitter(emitter);
  }

  update(delta: number) {
    if (this.spriteSystem.emitters.length > 0) {
      this.spriteSystem.update(delta);
    }
    if (this.meshSystem.emitters.length > 0) {
      this.meshSystem.update(delta);
    }
  }

  dispose() {
    useRemoveSignal("objectRemoved", _objectRemovedFn);
    _objectRemovedFn = null;
    useRemoveSignal("particleBodyChanged", _bodyChangedFn);
    _bodyChangedFn = null;

    this.spriteSystem.eventDispatcher.removeEventListener('EMITTER_ADDED', _addEmitterFn);
    this.meshSystem.eventDispatcher.removeEventListener('EMITTER_ADDED', _addEmitterFn);
    _addEmitterFn = null;

    this.spriteSystem.destroy();
    this.meshSystem.destroy();
  }
}

export { ParticleSystem };