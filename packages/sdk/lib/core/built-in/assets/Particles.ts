import * as THREE from 'three';
import * as _Particle from '#/core/libs/three-nebula';

export class Particles {
  static DotImageUrl = new URL(import.meta.env.BASE_URL + 'resource/textures/dot.png', import.meta.url).href;
  static SmokeImageUrl = new URL(import.meta.env.BASE_URL + 'resource/textures/smoke.png', import.meta.url).href;

  constructor() { }

  // 烟雾
  static smoke(initPosition = { x: 0, y: 0, z: 0 }) {
    const map = new THREE.TextureLoader().load(Particles.DotImageUrl);
    const material = new THREE.SpriteMaterial({
      map: map,
      color: 0x000000,
      // fog: true,
    });
    const body = new THREE.Sprite(material);

    const emitter = new _Particle.Emitter();
    emitter.damping = 0.008;

    const position = new _Particle.Position();
    position.addZone(new _Particle.PointZone(0, 0, 0));

    emitter
      .setRate(
        new _Particle.Rate(
          new _Particle.Span(20, 40), // 发射粒子的数量范围
          new _Particle.Span(0.01, 0.02) //每次粒子发射之间的时间间隔
        )
      ) // 设置粒子发射的速率
      .setInitializers([
        new _Particle.Mass(30, 10, true, true),  // 设置初始化粒子的质量属性
        new _Particle.Life(1, 3, false, true), // 设置初始化粒子的生命值属性
        new _Particle.Body(body), // 设置初始化粒子的主体属性
        new _Particle.Radius(1, 1, true, true),  // 设置初始化粒子的半径属性
        new _Particle.Rotation(0, 0, 0, true, true),  // 设置初始化粒子的旋转属性
        position,
        new _Particle.VectorVelocity(new _Particle.Vector3D(1, 2, 1), 60, true), // 设置初始化粒子的速度属性
      ]) //设置发射器的粒子初始化器
      .setBehaviours([
        new _Particle.Alpha(1, 0, Infinity, _Particle.ease.easeOutCubic, true), // 对粒子应用阿尔法转换效果的行为
        new _Particle.Color("#000000", "#0E0E0E", Infinity, _Particle.ease.easeOutCubic, true), // 一种随时间改变粒子颜色的行为
        //new _Particle.Scale(1, 0.5, Infinity, _Particle.ease.easeLinear, true), // 缩放粒子的行为
        new _Particle.Force(0, 2, 0, Infinity, _Particle.ease.easeLinear, true), // 迫使粒子沿特定轴线运动的行为
        //new _Particle.Rotate(45, 0, 0, Infinity, _Particle.ease.easeLinear, true), // 旋转粒子的行为
        new _Particle.RandomDrift(1, 2, 1, 0.7, Infinity, _Particle.ease.easeLinear), // 导致粒子漂移到三维空间随机坐标的行为
        //new _Particle.Spring(1, 5, 0, 0.01, 1, Infinity, _Particle.ease.easeLinear, true) // 使粒子弹起的行为
      ])
      .setPosition({ ...initPosition })
      .setRotation({
        x: 0,
        y: 0,
        z: 0,
      })
      .emit() // 可以接收两个参数来设置发射器发射粒子的总次数以及发射器的寿命。同时初始化发射器速率。这样发射器就能发射粒子。
      .setTotalEmitTimes(Infinity) // 设置发射器的总发射次数
      .setLife(Infinity) // 设置发射器的寿命(毫秒)

    return { emitter, body };
  }

  // 火焰
  static fire(initPosition = { x: 0, y: 0, z: 0 }) {
    const map = new THREE.TextureLoader().load(Particles.SmokeImageUrl);
    const material = new THREE.SpriteMaterial({
      map: map,
      color: 0xffffff,
      // fog: true,
    });
    const body = new THREE.Sprite(material);

    const emitter = new _Particle.Emitter();
    emitter.damping = 0.02;

    const position = new _Particle.Position();
    position.addZone(new _Particle.PointZone(0, 0, 0));

    emitter
      .setRate(
        new _Particle.Rate(
          new _Particle.Span(20, 30),
          new _Particle.Span(0.01, 0.02)
        )
      ) // 设置粒子发射的速率
      .setInitializers([
        new _Particle.Mass(30, 10, true, true),
        new _Particle.Life(1, 3, false, true),
        new _Particle.Body(body),
        new _Particle.Radius(1, 1, false, true),
        new _Particle.Rotation(0, 0, 0, true, true),
        position,
        new _Particle.RadialVelocity(4, new _Particle.Vector3D(0, 1, 0), 45, true),
      ]) //设置发射器的粒子初始化器
      .setBehaviours([
        new _Particle.Alpha(1, 0, Infinity, _Particle.ease.easeOutQuad, true),
        new _Particle.Color("#FF2D08", "#560000", Infinity, _Particle.ease.easeOutBack, true),
        new _Particle.Force(0, 2, 0, Infinity, _Particle.ease.easeLinear, true),
        new _Particle.Rotate(0, 0, 5, Infinity, _Particle.ease.easeLinear, true),
      ])
      .setPosition({ ...initPosition })
      .setRotation({
        x: 0,
        y: 0,
        z: 0,
      })
      .emit()
      .setTotalEmitTimes(Infinity)
      .setLife(Infinity)

    return { emitter, body };
  }

  // 火线
  static fireLine(initPosition = { x: 0, y: 0, z: 0 }) {
    const map = new THREE.TextureLoader().load(Particles.SmokeImageUrl);
    const material = new THREE.SpriteMaterial({
      map: map,
      color: 0xffffff,
      // fog: true,
    });
    const body = new THREE.Sprite(material);

    const emitter = new _Particle.Emitter();
    emitter.damping = 0.02;

    const position = new _Particle.Position();
    position.addZone(
      new _Particle.LineZone(
        5,
        0,
        0,
        -5,
        0,
        0,
      )
    );

    emitter
      .setRate(
        new _Particle.Rate(
          new _Particle.Span(30, 50),
          new _Particle.Span(0.01, 0.02)
        )
      ) // 设置粒子发射的速率
      .setInitializers([
        new _Particle.Mass(60, 50, false, true),
        new _Particle.Life(1, 3, false, true),
        new _Particle.Body(body),
        new _Particle.Radius(1, 1, false, true),
        new _Particle.Rotation(0, 0, 0, true, true),
        position,
      ]) //设置发射器的粒子初始化器
      .setBehaviours([
        new _Particle.Alpha(1, 0, Infinity, _Particle.ease.easeOutQuad, true),
        new _Particle.Color("#FF2D08", "#560000", Infinity, _Particle.ease.easeOutBack, true),
        new _Particle.Force(0, 2, 0, Infinity, _Particle.ease.easeLinear, true),
      ])
      .setPosition({ ...initPosition })
      .setRotation({
        x: 0,
        y: 0,
        z: 0,
      })
      .emit()
      .setTotalEmitTimes(Infinity)
      .setLife(Infinity)

    return { emitter, body };
  }

  // 萤火虫
  static firefly(initPosition = { x: 0, y: 0, z: 0 }) {
    const map = new THREE.TextureLoader().load(Particles.DotImageUrl);
    const material = new THREE.SpriteMaterial({
      map: map,
      color: 0x000000,
      // fog: true,
    });
    const body = new THREE.Sprite(material);

    const emitter = new _Particle.Emitter();
    emitter.damping = 1;

    const position = new _Particle.Position();
    position.addZone(
      new _Particle.BoxZone(
        0,
        0,
        0,
        100,
        100,
        100,
      )
    );

    emitter
      .setRate(
        new _Particle.Rate(
          new _Particle.Span(10, 20),
          new _Particle.Span(0.01, 0.02)
        )
      )
      .setInitializers([
        new _Particle.Life(1, 3, false, true),
        new _Particle.Body(body),
        new _Particle.Radius(0.5, 0.5, false, true),
        position,
      ])
      .setBehaviours([
        new _Particle.Alpha(1, 0.1, Infinity, _Particle.ease.easeOutQuad, true),
        new _Particle.Color("#3EF506", "#E6D200", Infinity, _Particle.ease.easeLinear, true),
        new _Particle.RandomDrift(1, 2, 1, 0.7, Infinity, _Particle.ease.easeLinear),
      ])
      .setPosition({ ...initPosition })
      .setRotation({
        x: 0,
        y: 0,
        z: 0,
      })
      .emit()
      .setTotalEmitTimes(Infinity)
      .setLife(Infinity)

    return { emitter, body };
  }

  // 烟花
  static fireworks(initPosition = { x: 0, y: 0, z: 0 }) {
    const map = new THREE.TextureLoader().load(Particles.DotImageUrl);
    const material = new THREE.SpriteMaterial({
      map: map,
      color: 0xff0000,
      blending: THREE.AdditiveBlending,
      // fog: true,
    });
    const body = new THREE.Sprite(material);

    const emitter = new _Particle.Emitter();

    const position = new _Particle.Position();
    position.addZone(new _Particle.SphereZone(0, 0, 0, 1));

    emitter
      .setRate(
        new _Particle.Rate(
          new _Particle.Span(30, 50),
          new _Particle.Span(0.05, 0.1)
        )
      )
      .setInitializers([
        new _Particle.Mass(1, 1, false, true),
        new _Particle.Life(1, 3, false, true),
        new _Particle.Body(body),
        new _Particle.Radius(1, 1, false, true),
        position,
        new _Particle.RadialVelocity(new _Particle.Span(50, 80), new _Particle.Vector3D(0, 1, 0), 30),
      ])
      .setBehaviours([
        new _Particle.Scale(new _Particle.Span(2, 2.5), 0, Infinity, _Particle.ease.easeLinear, true),
        new _Particle.Color('#FF0026', '#ffff11', Infinity, _Particle.ease.easeOutSine, true),
        new _Particle.Force(0, -0.6, 0, Infinity, _Particle.ease.easeLinear, true),
        new _Particle.RandomDrift(1, 1, 1, 0.5, Infinity, _Particle.ease.easeLinear),
      ])
      .setPosition({ ...initPosition })
      .setRotation({
        x: 0,
        y: 0,
        z: 0,
      })
      .emit()
      .setTotalEmitTimes(Infinity)
      .setLife(Infinity)

    return { emitter, body };
  }
}
