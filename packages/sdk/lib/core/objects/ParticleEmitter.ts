/**
 * 用于代理粒子发射器的空对象，以便于进行场景树显示及控制操作
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2025-02-14 16:00:00
 */
import * as THREE from 'three';
import * as Particle from '#/core/libs/three-nebula';
import { ParticleSystem } from '#/core/viewer/modules/ParticleSystem';
import { ObjectLoader } from '#/core/loader/ObjectLoader';
import { useAddSignal, useDispatchSignal, useRemoveSignal } from '#/hooks';

/**
 * 获取默认粒子配置
 * @description 以函数调用的方式返回，避免在模块外被引用
 */
export const getDefaultParticleConfig = (): IParticle.Config => ({
  attr: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
    totalEmitTimes: Infinity,
    damping: 0.006,
    life: Infinity,
    numPan: {
      min: 1,
      max: 1
    },
    timePan: {
      a: 0.1,
      b: 0.1
    }
  },
  init: {
    mass: {
      min: 1,
      max: 1,
      center: true,
      isEnabled: false
    },
    life: {
      min: 1,
      max: 1,
      center: true,
      isEnabled: false
    },
    radius: {
      width: 1,
      height: 1,
      center: false,
      isEnabled: false
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0,
      useEmitterRotation: false,
      isEnabled: false
    },
    position: {
      isEnabled: false,
      zone: null
    },
    velocity: {
      isEnabled: false,
      velocity: null
    },
    body: {
      isEnabled: false,
      body: {
        type: 'Sprite',
        uuid: '',
      }
    }
  },
  behaviour: {
    color: {
      isEnabled: false,
      colorA: "#002a4f",
      colorB: "#0029FF",
      life: Infinity,
      easing: 'easeLinear',
    },
    scale: {
      isEnabled: false,
      scaleA: 1,
      scaleB: 1,
      life: Infinity,
      easing: 'easeLinear',
    },
    alpha: {
      isEnabled: false,
      alphaA: 1,
      alphaB: 1,
      life: Infinity,
      easing: 'easeLinear',
    },
    force: {
      isEnabled: false,
      fx: 0,
      fy: 0,
      fz: 0,
      life: Infinity,
      easing: 'easeLinear',
    },
    rotate: {
      isEnabled: false,
      x: 0,
      y: 0,
      z: 0,
      life: Infinity,
      easing: 'easeLinear',
    },
    randomDrift: {
      isEnabled: false,
      driftX: 0,
      driftY: 0,
      driftZ: 0,
      delay: 0.03,
      life: Infinity,
      easing: 'easeLinear',
    },
    spring: {
      isEnabled: false,
      x: 0,
      y: 0,
      z: 0,
      spring: 0.1,
      friction: 0.98,
      life: Infinity,
      easing: 'easeLinear',
    },
    attraction: {
      x: 0,
      y: 0,
      z: 0,
      force: 100,
      radius: 1000,
      life: Infinity,
      easing: 'easeLinear',
      isEnabled: false
    },
    collision: {
      useMass: false,
      life: Infinity,
      easing: 'easeLinear',
      isEnabled: false
    }
  },
})

let _handleAddToParticleSystemFn, _handleParticleCreatedFn;
class ParticleEmitter extends THREE.Object3D {
  emitter: Particle.Emitter;

  isEmitterProxy = true;

  constructor(emitter: Particle.Emitter) {
    super();

    // @ts-ignore
    this.type = 'Particle';

    this.emitter = emitter;

    this.syncProperties();

    this.proxyProperties();

    this.initEvent();
  }

  initEvent() {
    /**
      * 需要做粒子的选中，选中时定位到这个粒子发射器的代理对象上
      * 如果后续不需要做粒子选中了，就把下方代码删除
      * 对应的particleSystemAddEmitter signal也删除
      */
    _handleAddToParticleSystemFn = this.handleAddToParticleSystem.bind(this);
    useAddSignal('particleSystemAddEmitter', _handleAddToParticleSystemFn)
    this.emitter.particles.forEach(particle => {
      if (!particle.target) return;

      particle.target.proxy = this;
    })
    _handleParticleCreatedFn = this.handleParticleCreated.bind(this);
    this.emitter.parent?.eventDispatcher.addEventListener('PARTICLE_CREATED', _handleParticleCreatedFn, true)
  }

  /**
   * 监听粒子创建
   * @param particle 
   */
  handleParticleCreated(particle) {
    if (!this.emitter?.particles) return;

    if (!this.emitter.particles.includes(particle)) return;

    if (!particle.target) return;

    particle.target.proxy = this;
  }

  /**
   * 添加到粒子系统时
   * @param _emitter 
   */
  handleAddToParticleSystem(_emitter: Particle.Emitter) {
    if (_emitter === this.emitter) {
      this.emitter.parent?.eventDispatcher.addEventListener('PARTICLE_CREATED', _handleParticleCreatedFn, true)
    }
  }

  /**
   * 同步粒子发射器的属性到组中
   */
  syncProperties() {
    this.position.set(this.emitter.position.x, this.emitter.position.y, this.emitter.position.z);
    // 粒子发射器的缩放是统一的，无法从三个轴分开设置
    this.scale.set(this.emitter.scale, this.emitter.scale, this.emitter.scale);
    this.rotation.set(this.emitter.rotation.x, this.emitter.rotation.y, this.emitter.rotation.z);

    this.updateMatrixWorld(true);
  }

  /**
   * 拦截重要属性的 setter 方法，同步到粒子发射器中
   */
  proxyProperties() {
    // 重写 position 的 setter 方法
    let _position = new THREE.Vector3().copy(this.position);
    Object.defineProperty(this.position, 'x', {
      get: () => _position.x,
      set: (value: number) => {
        _position.setX(value);
        this.emitter.position.x = value;
      },
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(this.position, 'y', {
      get: () => _position.y,
      set: (value: number) => {
        _position.setY(value);
        this.emitter.position.y = value;
      },
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(this.position, 'z', {
      get: () => _position.z,
      set: (value: number) => {
        _position.setZ(value);
        this.emitter.position.z = value;
      },
      configurable: true,
      enumerable: true
    });

    // 重写 rotation 的 setter 方法
    let _rotation = this.rotation.clone();
    Object.defineProperty(this.rotation, '_x', {
      get: () => _rotation.x,
      set: (value: number) => {
        _rotation.x = value;
        // this.emitter.rotation.x = value * THREE.MathUtils.RAD2DEG;
        this.emitter.rotation.x = value;
      },
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(this.rotation, '_y', {
      get: () => _rotation.y,
      set: (value: number) => {
        _rotation.y = value;
        this.emitter.rotation.y = value;
      },
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(this.rotation, '_z', {
      get: () => _rotation.z,
      set: (value: number) => {
        _rotation.z = value;
        this.emitter.rotation.z = value;
      },
      configurable: true,
      enumerable: true
    });

    // 重写 scale 的 setter 方法
    let _scale = this.scale.clone();
    Object.defineProperty(this.scale, 'x', {
      get: () => _scale.x,
      set: (value: number) => {
        _scale.setX(value);
        // 获取scale三轴中的最小值应用到粒子发射器
        this.emitter.scale = Math.min(_scale.x, _scale.y, _scale.z);
      },
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(this.scale, 'y', {
      get: () => _scale.y,
      set: (value: number) => {
        _scale.setY(value);
        // 获取scale三轴中的最小值应用到粒子发射器
        this.emitter.scale = Math.min(_scale.x, _scale.y, _scale.z);
      },
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(this.scale, 'z', {
      get: () => _scale.z,
      set: (value: number) => {
        _scale.setZ(value);
        // 获取scale三轴中的最小值应用到粒子发射器
        this.emitter.scale = Math.min(_scale.x, _scale.y, _scale.z);
      },
      configurable: true,
      enumerable: true
    });

    // 重写 visible 的 setter 方法
    let _visible = this.visible, _totalEmitTimes = this.emitter.totalEmitTimes;
    Object.defineProperty(this, 'visible', {
      get: () => _visible,
      set: (value: boolean) => {
        _visible = value;

        // 发射器上不存在直接控制显隐的属性，遍历粒子对象设置显隐影响瞬时性能，故使用emitter.totalEmitTimes控制显隐
        this.emitter.totalEmitTimes = value ? _totalEmitTimes : 0;
      },
      configurable: true,
      enumerable: true
    })
  }

  /**
   * 获取emitter的json配置
   */
  getEmitterJSON() {
    const emitter: IParticle.Config = getDefaultParticleConfig();
    emitter.attr = {
      position: JSON.parse(JSON.stringify(this.emitter.position)),
      rotation: JSON.parse(JSON.stringify(this.emitter.rotation)),
      scale: this.emitter.scale,
      totalEmitTimes: this.emitter.totalEmitTimes,
      damping: this.emitter.damping,
      life: this.emitter.life,
      numPan: {
        min: this.emitter.rate.numPan.a,
        max: this.emitter.rate.numPan.b,
      },
      timePan: {
        a: this.emitter.rate.timePan.a,
        b: this.emitter.rate.timePan.b,
      }
    };

    this.emitter.initializers.forEach(initializer => {
      switch (initializer.type) {
        case "Mass":
          emitter.init.mass.isEnabled = initializer.isEnabled;
          emitter.init.mass.min = initializer.massPan.a;
          emitter.init.mass.max = initializer.massPan.b;
          emitter.init.mass.center = initializer.massPan._center;
          break;
        case "Life":
          emitter.init.life.isEnabled = initializer.isEnabled;
          emitter.init.life.min = initializer.lifePan.a;
          emitter.init.life.max = initializer.lifePan.b;
          emitter.init.life.center = initializer.lifePan._center;
          break;
        case "Radius":
          emitter.init.radius.isEnabled = initializer.isEnabled;
          emitter.init.radius.width = initializer.radius.a;
          emitter.init.radius.height = initializer.radius.b;
          emitter.init.radius.center = initializer.radius._center;
          break;
        case "Rotation":
          emitter.init.rotation.isEnabled = initializer.isEnabled;
          emitter.init.rotation.x = initializer.rotation.x;
          emitter.init.rotation.y = initializer.rotation.y;
          emitter.init.rotation.z = initializer.rotation.z;
          emitter.init.rotation.useEmitterRotation = initializer.useEmitterRotation;
          break;
        case "Position":
          emitter.init.position.isEnabled = initializer.isEnabled;
          emitter.init.position.zone = (function () {
            const zone = initializer.zones[0];
            switch (zone.type) {
              case 'PointZone':
                return {
                  type: 'PointZone',
                  x: zone.x,
                  y: zone.y,
                  z: zone.z
                }
              case 'LineZone':
                return {
                  type: 'LineZone',
                  x1: zone.x1,
                  y1: zone.y1,
                  z1: zone.z1,
                  x2: zone.x2,
                  y2: zone.y2,
                  z2: zone.z2,
                }
              case 'BoxZone':
                return {
                  type: 'BoxZone',
                  depth: zone.depth,
                  height: zone.height,
                  width: zone.width,
                  x: zone.x,
                  y: zone.y,
                  z: zone.z
                }
              case 'SphereZone':
                return {
                  type: 'SphereZone',
                  radius: zone.radius,
                  x: zone.x,
                  y: zone.y,
                  z: zone.z
                }
              default:
                return null;
            }
          })()
          break;
        case 'RadialVelocity':
          emitter.init.velocity.isEnabled = initializer.isEnabled;
          emitter.init.velocity.velocity = {
            type: 'RadialVelocity',
            radius: initializer.radiusPan.a,
            x: initializer.dir.x,
            y: initializer.dir.y,
            z: initializer.dir.z,
            theta: initializer.tha * 180 / Math.PI,
          }
          break;
        case "PolarVelocity":
          emitter.init.velocity.isEnabled = initializer.isEnabled;
          emitter.init.velocity.velocity = {
            type: 'PolarVelocity',
            radius: initializer._polar.radius,
            theta: initializer._polar.theta * 180 / Math.PI,
            phi: initializer._polar.phi * 180 / Math.PI,
            tha: initializer.tha * 180 / Math.PI,
          }
          break;
        case 'VectorVelocity':
          emitter.init.velocity.isEnabled = initializer.isEnabled;
          emitter.init.velocity.velocity = {
            type: 'VectorVelocity',
            x: initializer.dir.x,
            y: initializer.dir.y,
            z: initializer.dir.z,
            theta: initializer.tha * 180 / Math.PI,
          }
          break;
        case "Body":
          emitter.init.body.isEnabled = initializer.isEnabled;
          emitter.init.body.body = {
            type: initializer.body.items[0].type === 'Sprite' ? 'Sprite' : initializer.body.items[0].type === 'Points' ? 'Point' : 'Mesh',
            uuid: this.uuid
          }
          break;
      }
    });

    this.emitter.behaviours.forEach(behaviour => {
      switch (behaviour.type) {
        case "Color":
          emitter.behaviour.color.isEnabled = behaviour.isEnabled;
          emitter.behaviour.color.colorA = behaviour.colorA.colors[0];
          emitter.behaviour.color.colorB = behaviour.colorB.colors[0];
          emitter.behaviour.color.life = behaviour._life;
          emitter.behaviour.color.easing = behaviour.easing.name;
          break;
        case "Scale":
          emitter.behaviour.scale.isEnabled = behaviour.isEnabled;
          emitter.behaviour.scale.scaleA = behaviour.scaleA.a;
          emitter.behaviour.scale.scaleB = behaviour.scaleB.a;
          emitter.behaviour.scale.life = behaviour._life;
          emitter.behaviour.scale.easing = behaviour.easing.name;
          break;
        case "Alpha":
          emitter.behaviour.alpha.isEnabled = behaviour.isEnabled;
          emitter.behaviour.alpha.alphaA = behaviour.alphaA.a;
          emitter.behaviour.alpha.alphaB = behaviour.alphaB.a;
          emitter.behaviour.alpha.life = behaviour._life;
          emitter.behaviour.alpha.easing = behaviour.easing.name;
          break;
        case "Force":
          emitter.behaviour.force.isEnabled = behaviour.isEnabled;
          emitter.behaviour.force.fx = behaviour.force.x / 100;
          emitter.behaviour.force.fy = behaviour.force.y / 100;
          emitter.behaviour.force.fz = behaviour.force.z / 100;
          emitter.behaviour.force.life = behaviour._life;
          emitter.behaviour.force.easing = behaviour.easing.name;
          break;
        case "Rotate":
          emitter.behaviour.rotate.isEnabled = behaviour.isEnabled;
          emitter.behaviour.rotate.x = behaviour.x.a * 180 / Math.PI;
          emitter.behaviour.rotate.y = behaviour.y.a * 180 / Math.PI;
          emitter.behaviour.rotate.z = behaviour.z.a * 180 / Math.PI;
          emitter.behaviour.rotate.life = behaviour._life;
          emitter.behaviour.rotate.easing = behaviour.easing.name;
          break;
        case "RandomDrift":
          emitter.behaviour.randomDrift.isEnabled = behaviour.isEnabled;
          emitter.behaviour.randomDrift.driftX = behaviour.randomForce.x / 100;
          emitter.behaviour.randomDrift.driftY = behaviour.randomForce.y / 100;
          emitter.behaviour.randomDrift.driftZ = behaviour.randomForce.z / 100;
          emitter.behaviour.randomDrift.delay = behaviour.delayPan.a;
          emitter.behaviour.randomDrift.life = behaviour._life;
          emitter.behaviour.randomDrift.easing = behaviour.easing.name;
          break;
        case "Spring":
          emitter.behaviour.spring.isEnabled = behaviour.isEnabled;
          emitter.behaviour.spring.x = behaviour.pos.x;
          emitter.behaviour.spring.y = behaviour.pos.y;
          emitter.behaviour.spring.z = behaviour.pos.z;
          emitter.behaviour.spring.spring = behaviour.spring;
          emitter.behaviour.spring.friction = behaviour.friction;
          emitter.behaviour.spring.life = behaviour._life;
          emitter.behaviour.spring.easing = behaviour.easing.name;
          break;
        case "Attraction":
          emitter.behaviour.attraction.isEnabled = behaviour.isEnabled;
          emitter.behaviour.attraction.x = behaviour.targetPosition.x;
          emitter.behaviour.attraction.y = behaviour.targetPosition.y;
          emitter.behaviour.attraction.z = behaviour.targetPosition.z;
          emitter.behaviour.attraction.force = behaviour.force / 100;
          emitter.behaviour.attraction.radius = behaviour.radius;
          emitter.behaviour.attraction.life = behaviour._life;
          emitter.behaviour.attraction.easing = behaviour.easing.name;
          break;
        case "Collision":
          emitter.behaviour.collision.isEnabled = behaviour.isEnabled;
          emitter.behaviour.collision.useMass = behaviour.useMass;
          emitter.behaviour.collision.life = behaviour._life;
          emitter.behaviour.collision.easing = behaviour.easing.name;
          break;
      }
    });

    return emitter;
  }

  /**
   * 从json配置解析
   */
  static fromJSON(json: IParticle.Object3DJSON) {
    const emitterConfig = json.emitter.config;

    const emitter = new Particle.Emitter({
      position: new Particle.Vector3D(
        emitterConfig.attr.position.x,
        emitterConfig.attr.position.y,
        emitterConfig.attr.position.z
      ),
      rotation: new Particle.Vector3D(
        emitterConfig.attr.rotation.x,
        emitterConfig.attr.rotation.y,
        emitterConfig.attr.rotation.z
      ),
      scale: emitterConfig.attr.scale,
      life: emitterConfig.attr.life
    });
    emitter.totalEmitTimes = emitterConfig.attr.totalEmitTimes;
    emitter.damping = emitterConfig.attr.damping;
    emitter.rate = new Particle.Rate(
      new Particle.Span(emitterConfig.attr.numPan.min, emitterConfig.attr.numPan.max),
      new Particle.Span(emitterConfig.attr.timePan.a, emitterConfig.attr.timePan.b)
    );
    emitter.emit();

    // 还原initializers
    json.emitter.useInitializers.forEach(initializer => {
      switch (initializer) {
        case "Mass":
          emitter.addInitializer(
            new Particle.Mass(
              emitterConfig.init.mass.min,
              emitterConfig.init.mass.max,
              emitterConfig.init.mass.center,
              emitterConfig.init.mass.isEnabled
            )
          );
          break;
        case "Life":
          emitter.addInitializer(
            new Particle.Life(
              emitterConfig.init.life.min,
              emitterConfig.init.life.max,
              emitterConfig.init.life.center,
              emitterConfig.init.life.isEnabled
            )
          );
          break;
        case "Radius":
          emitter.addInitializer(
            new Particle.Radius(
              emitterConfig.init.radius.width,
              emitterConfig.init.radius.height,
              emitterConfig.init.radius.center,
              emitterConfig.init.radius.isEnabled
            )
          );
          break;
        case "Rotation":
          emitter.addInitializer(
            new Particle.Rotation(
              emitterConfig.init.rotation.x,
              emitterConfig.init.rotation.y,
              emitterConfig.init.rotation.z,
              emitterConfig.init.rotation.useEmitterRotation,
              emitterConfig.init.rotation.isEnabled
            )
          );
          break;
        case "Position":
          let position = new Particle.Position();
          emitter.addInitializer(position);

          let zone;
          const zoneData = emitterConfig.init.position.zone;
          switch (zoneData?.type) {
            case 'PointZone':
              zone = new Particle.PointZone(zoneData.x, zoneData.y, zoneData.z);
              break;
            case 'LineZone':
              zone = new Particle.LineZone(
                zoneData.x1,
                zoneData.y1,
                zoneData.z1,
                zoneData.x2,
                zoneData.y2,
                zoneData.z2,
              );
              break;
            case 'BoxZone':
              zone = new Particle.BoxZone(
                zoneData.x,
                zoneData.y,
                zoneData.z,
                zoneData.width,
                zoneData.height,
                zoneData.depth,
              );
              break;
            case 'SphereZone':
              zone = new Particle.SphereZone(
                zoneData.x,
                zoneData.y,
                zoneData.z,
                zoneData.radius
              );
              break;
          }
          if (!zone) return;

          position.addZone(zone);
          break;
        case "RadialVelocity": {
          const velocity = emitterConfig.init.velocity.velocity as IParticle.RadialVelocity;

          emitter.addInitializer(
            new Particle.RadialVelocity(
              velocity.radius,
              new Particle.Vector3D(
                velocity.x,
                velocity.y,
                velocity.z
              ),
              velocity.theta,
              emitterConfig.init.velocity.isEnabled
            )
          );
        }
          break;
        case "PolarVelocity": {
          const velocity = emitterConfig.init.velocity.velocity as IParticle.PolarVelocity;

          emitter.addInitializer(
            new Particle.PolarVelocity(
              new Particle.Polar3D(velocity.radius, velocity.theta * Math.PI / 180, velocity.phi * Math.PI / 180),
              velocity.tha,
              emitterConfig.init.velocity.isEnabled
            )
          );
        }
          break;
        case "VectorVelocity": {
          const velocity = emitterConfig.init.velocity.velocity as IParticle.VectorVelocity;

          emitter.addInitializer(
            new Particle.VectorVelocity(
              new Particle.Vector3D(velocity.x, velocity.y, velocity.z),
              velocity.theta,
              emitterConfig.init.velocity.isEnabled
            )
          );
        }
          break;
        case "Body":
          if (!emitterConfig.init.body.body) break;

          switch (emitterConfig.init.body.body.type) {
            case "Sprite":
            case "Mesh":
              new ObjectLoader().parse(json.emitter.bodyObjectJSON, (object3D => {
                emitter.addInitializer(
                  new Particle.Body(
                    object3D,
                    null,
                    null,
                    emitterConfig.init.body.isEnabled
                  )
                );
                ParticleSystem.Body3DMap.set(json.uuid, object3D);
              }))
              break;
            case "Point":
              emitter.addInitializer(
                new Particle.Body(
                  ParticleSystem.PointBody.clone(),
                  null,
                  null,
                  emitterConfig.init.body.isEnabled
                )
              );
              break;
          }
          break;
      }
    })

    // 还原behaviours
    json.emitter.useBehaviours.forEach(behaviour => {
      switch (behaviour) {
        case "Color":
          emitter.addBehaviour(
            new Particle.Color(
              emitterConfig.behaviour.color.colorA,
              emitterConfig.behaviour.color.colorB,
              emitterConfig.behaviour.color.life,
              Particle.ease[emitterConfig.behaviour.color.easing],
              emitterConfig.behaviour.color.isEnabled
            )
          )
          break;
        case "Scale":
          emitter.addBehaviour(
            new Particle.Scale(
              emitterConfig.behaviour.scale.scaleA,
              emitterConfig.behaviour.scale.scaleB,
              emitterConfig.behaviour.scale.life,
              Particle.ease[emitterConfig.behaviour.scale.easing],
              emitterConfig.behaviour.scale.isEnabled
            )
          )
          break;
        case "Alpha":
          emitter.addBehaviour(
            new Particle.Alpha(
              emitterConfig.behaviour.alpha.alphaA,
              emitterConfig.behaviour.alpha.alphaB,
              emitterConfig.behaviour.alpha.life,
              Particle.ease[emitterConfig.behaviour.alpha.easing],
              emitterConfig.behaviour.alpha.isEnabled
            )
          )
          break;
        case "Force":
          emitter.addBehaviour(
            new Particle.Force(
              emitterConfig.behaviour.force.fx,
              emitterConfig.behaviour.force.fy,
              emitterConfig.behaviour.force.fz,
              emitterConfig.behaviour.force.life,
              Particle.ease[emitterConfig.behaviour.force.easing],
              emitterConfig.behaviour.force.isEnabled
            )
          )
          break;
        case "Rotate":
          emitter.addBehaviour(
            new Particle.Rotate(
              emitterConfig.behaviour.rotate.x,
              emitterConfig.behaviour.rotate.y,
              emitterConfig.behaviour.rotate.z,
              emitterConfig.behaviour.rotate.life,
              Particle.ease[emitterConfig.behaviour.rotate.easing],
              emitterConfig.behaviour.rotate.isEnabled
            )
          )
          break;
        case "RandomDrift":
          emitter.addBehaviour(
            new Particle.RandomDrift(
              emitterConfig.behaviour.randomDrift.driftX,
              emitterConfig.behaviour.randomDrift.driftY,
              emitterConfig.behaviour.randomDrift.driftZ,
              emitterConfig.behaviour.randomDrift.delay,
              emitterConfig.behaviour.randomDrift.life,
              Particle.ease[emitterConfig.behaviour.randomDrift.easing],
              emitterConfig.behaviour.randomDrift.isEnabled
            )
          )
          break;
        case "Spring":
          emitter.addBehaviour(
            new Particle.Spring(
              emitterConfig.behaviour.spring.x,
              emitterConfig.behaviour.spring.y,
              emitterConfig.behaviour.spring.z,
              emitterConfig.behaviour.spring.spring,
              emitterConfig.behaviour.spring.friction,
              emitterConfig.behaviour.spring.life,
              Particle.ease[emitterConfig.behaviour.spring.easing],
              emitterConfig.behaviour.spring.isEnabled
            )
          )
          break;
        case "Attraction":
          emitter.addBehaviour(
            new Particle.Attraction(
              new Particle.Vector3D(
                emitterConfig.behaviour.attraction.x,
                emitterConfig.behaviour.attraction.y,
                emitterConfig.behaviour.attraction.z
              ),
              emitterConfig.behaviour.attraction.force,
              emitterConfig.behaviour.attraction.radius,
              emitterConfig.behaviour.attraction.life,
              Particle.ease[emitterConfig.behaviour.attraction.easing],
              emitterConfig.behaviour.attraction.isEnabled
            )
          )
          break;
        case "Collision":
          emitter.addBehaviour(
            new Particle.Collision(
              emitter,
              emitterConfig.behaviour.collision.useMass,
              () => { },
              emitterConfig.behaviour.collision.life,
              Particle.ease[emitterConfig.behaviour.collision.easing],
              emitterConfig.behaviour.collision.isEnabled
            )
          )
          break;
      }
    })

    useDispatchSignal("emitterAdd2ParticleSystem", emitter, json.emitter.system)

    const particleEmitter = new ParticleEmitter(emitter);
    particleEmitter.name = json.name;
    particleEmitter.uuid = json.uuid;

    return particleEmitter;
  }

  /**
   * 获取json配置
   */
  toJSON(meta?: THREE.JSONMeta) {
    const superJSON = super.toJSON(meta).object;
    // @ts-ignore
    superJSON.matrix = undefined;
    // @ts-ignore
    delete superJSON.matrix;

    // 父级toJSON调用子级toJSON时，只会保留object对象，主要信息都需要放在这
    const object: IParticle.Object3DJSON = {
      uuid: this.uuid,
      type: this.type,
      name: this.name,
      emitter: {
        config: this.getEmitterJSON(),
        system: this.emitter.parent.name,
        useInitializers: this.emitter.initializers.map(initializer => initializer.type),
        bodyObjectJSON: ParticleSystem.Body3DMap.get(this.uuid)?.toJSON() || null,
        useBehaviours: this.emitter.behaviours.map(behaviour => behaviour.type)
      },
      children: [],
    };

    if (this.children.length > 0) {
      object.children = [];
      for (let i = 0; i < this.children.length; i++) {
        //@ts-ignore
        object.children.push(this.children[i].toJSON(meta).object);
      }
    }

    return {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'ParticleEmitter.toJSON'
      },
      object: Object.assign(superJSON, object),
    } as any;
  }

  /**
   * 销毁
   */
  dispose() {
    // 手动销毁所有粒子模型对象，发射器的destroy方法不会进行销毁
    this.emitter.particles && this.emitter.particles.forEach(p => {
      if (!p.target) return;

      p.target.removeFromParent();
    })

    useRemoveSignal('particleSystemAddEmitter', _handleAddToParticleSystemFn);
    _handleAddToParticleSystemFn = null;

    this.emitter.parent?.eventDispatcher.removeEventListener('PARTICLE_CREATED', _handleParticleCreatedFn);
    _handleParticleCreatedFn = null;

    this.emitter.destroy();
  }
}

export default ParticleEmitter;