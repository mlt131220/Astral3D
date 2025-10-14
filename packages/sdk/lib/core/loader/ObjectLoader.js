/**
 * THREE JSON 解析器
 * @author ErSan
 * @version 2.0.0
 * @description 来自于THREE.ObjectLoader，修改了部分代码，添加了部分功能
 */
import * as THREE from 'three'
import {
  TYPED_ARRAYS,
  TEXTURE_MAPPING,
  TEXTURE_WRAPPING,
  TEXTURE_FILTER,
} from '#/constant/index'
import ParticleEmitter from '#/core/objects/ParticleEmitter'
import Billboard from '#/core/objects/Billboard'
import { HtmlPanel, HtmlSprite } from '#/core/objects/HtmlPanel'
import Tiles from '../objects/Tile.js'

class ObjectLoader extends THREE.Loader {
  constructor(manager) {
    super(manager)
  }

  load(url, onLoad, onProgress, onError) {
    const scope = this

    const path =
      this.path === '' ? THREE.LoaderUtils.extractUrlBase(url) : this.path
    this.resourcePath = this.resourcePath || path

    const loader = new THREE.FileLoader(this.manager)
    loader.setPath(this.path)
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)
    loader.load(
      url,
      function (text) {
        let json = null

        try {
          json = JSON.parse(text)
        } catch (error) {
          if (onError !== undefined) onError(error)

          console.error(
            "THREE:ObjectLoader: Can't parse " + url + '.',
            error.message
          )

          return
        }

        const metadata = json.metadata

        if (
          metadata === undefined ||
          metadata.type === undefined ||
          metadata.type.toLowerCase() === 'geometry'
        ) {
          if (onError !== undefined)
            onError(new Error("THREE.ObjectLoader: Can't load " + url))

          console.error("THREE.ObjectLoader: Can't load " + url)
          return
        }

        scope.parse(json, onLoad)
      },
      onProgress,
      onError
    )
  }

  async loadAsync(url, onProgress) {
    const scope = this

    const path =
      this.path === '' ? THREE.LoaderUtils.extractUrlBase(url) : this.path
    this.resourcePath = this.resourcePath || path

    const loader = new THREE.FileLoader(this.manager)
    loader.setPath(this.path)
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)

    const text = await loader.loadAsync(url, onProgress)

    const json = JSON.parse(text)

    const metadata = json.metadata

    if (
      metadata === undefined ||
      metadata.type === undefined ||
      metadata.type.toLowerCase() === 'geometry'
    ) {
      throw new Error("THREE.ObjectLoader: Can't load " + url)
    }

    return await scope.parseAsync(json)
  }

  parse(json, onLoad) {
    const animations = this.parseAnimations(json.animations)
    const shapes = this.parseShapes(json.shapes)
    const geometries = this.parseGeometries(json.geometries, shapes)

    const images = this.parseImages(json.images, function () {
      if (onLoad !== undefined) onLoad(object)
    })

    const textures = this.parseTextures(json.textures, images)
    const materials = this.parseMaterials(json.materials, textures)

    const object = this.parseObject(
      json.object,
      geometries,
      materials,
      textures,
      animations
    )
    const skeletons = this.parseSkeletons(json.skeletons, object)

    this.bindSkeletons(object, skeletons)
    this.bindLightTargets(object)

    //

    if (onLoad !== undefined) {
      let hasImages = false

      for (const uuid in images) {
        if (images[uuid].data instanceof HTMLImageElement) {
          hasImages = true
          break
        }
      }

      if (hasImages === false) onLoad(object)
    }

    return object
  }

  async parseAsync(json) {
    const animations = this.parseAnimations(json.animations)
    const shapes = this.parseShapes(json.shapes)
    const geometries = this.parseGeometries(json.geometries, shapes)

    const images = await this.parseImagesAsync(json.images)

    const textures = this.parseTextures(json.textures, images)
    const materials = this.parseMaterials(json.materials, textures)

    const object = await this.parseObject(
      json.object,
      geometries,
      materials,
      textures,
      animations
    )
    const skeletons = this.parseSkeletons(json.skeletons, object)

    this.bindSkeletons(object, skeletons)
    this.bindLightTargets(object)

    return object
  }

  parseShapes(json) {
    const shapes = {}

    if (json !== undefined) {
      for (let i = 0, l = json.length; i < l; i++) {
        const shape = new THREE.Shape().fromJSON(json[i])

        shapes[shape.uuid] = shape
      }
    }

    return shapes
  }

  parseSkeletons(json, object) {
    const skeletons = {}
    const bones = {}

    // generate bone lookup table

    object.traverse(function (child) {
      if (child.isBone) bones[child.uuid] = child
    })

    // create skeletons

    if (json !== undefined) {
      for (let i = 0, l = json.length; i < l; i++) {
        const skeleton = new THREE.Skeleton().fromJSON(json[i], bones)

        skeletons[skeleton.uuid] = skeleton
      }
    }

    return skeletons
  }

  parseGeometries(json, shapes) {
    const geometries = {}

    if (json !== undefined) {
      const bufferGeometryLoader = new THREE.BufferGeometryLoader()

      for (let i = 0, l = json.length; i < l; i++) {
        let geometry
        const data = json[i]

        switch (data.type) {
          case 'BufferGeometry':
          case 'InstancedBufferGeometry':
            geometry = bufferGeometryLoader.parse(data)
            break

          default:
            if (data.type in THREE) {
              geometry = THREE[data.type].fromJSON(data, shapes)
            } else {
              console.warn(
                `THREE.ObjectLoader: Unsupported geometry type "${data.type}"`
              )
            }
        }

        geometry.uuid = data.uuid

        if (data.name !== undefined) geometry.name = data.name
        if (data.userData !== undefined) geometry.userData = data.userData

        geometries[data.uuid] = geometry
      }
    }

    return geometries
  }

  parseMaterials(json, textures) {
    const cache = {} // MultiMaterial
    const materials = {}

    if (json !== undefined) {
      const loader = new THREE.MaterialLoader()
      loader.setTextures(textures)

      for (let i = 0, l = json.length; i < l; i++) {
        const data = json[i]

        if (cache[data.uuid] === undefined) {
          cache[data.uuid] = loader.parse(data)
        }

        materials[data.uuid] = cache[data.uuid]
      }
    }

    return materials
  }

  parseAnimations(json) {
    const animations = {}

    if (json !== undefined) {
      for (let i = 0; i < json.length; i++) {
        const data = json[i]

        const clip = THREE.AnimationClip.parse(data)

        animations[clip.uuid] = clip
      }
    }

    return animations
  }

  parseImages(json, onLoad) {
    const scope = this
    const images = {}

    let loader

    function loadImage(url) {
      scope.manager.itemStart(url)

      return loader.load(
        url,
        function () {
          scope.manager.itemEnd(url)
        },
        undefined,
        function () {
          scope.manager.itemError(url)
          scope.manager.itemEnd(url)
        }
      )
    }

    function deserializeImage(image) {
      if (typeof image === 'string') {
        const url = image

        const path = /^(\/\/)|([a-z]+:(\/\/)?)/i.test(url)
          ? url
          : scope.resourcePath + url

        return loadImage(path)
      } else {
        if (image.data) {
          return {
            data: new TYPED_ARRAYS[image.type](image.data),
            width: image.width,
            height: image.height,
          }
        } else {
          return null
        }
      }
    }

    if (json !== undefined && json.length > 0) {
      const manager = new THREE.LoadingManager(onLoad)

      loader = new THREE.ImageLoader(manager)
      loader.setCrossOrigin(this.crossOrigin)

      for (let i = 0, il = json.length; i < il; i++) {
        const image = json[i]
        if (image === null || image === undefined) {
          continue
        }
        const url = image.url

        if (Array.isArray(url)) {
          // load array of images e.g CubeTexture

          const imageArray = []

          for (let j = 0, jl = url.length; j < jl; j++) {
            const currentUrl = url[j]

            const deserializedImage = deserializeImage(currentUrl)

            if (deserializedImage !== null) {
              if (deserializedImage instanceof HTMLImageElement) {
                imageArray.push(deserializedImage)
              } else {
                // special case: handle array of data textures for cube textures

                imageArray.push(
                  new THREE.DataTexture(
                    deserializedImage.data,
                    deserializedImage.width,
                    deserializedImage.height
                  )
                )
              }
            }
          }

          images[image.uuid] = new THREE.Source(imageArray)
        } else {
          // load single image

          const deserializedImage = deserializeImage(image.url)
          images[image.uuid] = new THREE.Source(deserializedImage)
        }
      }
    }

    return images
  }

  async parseImagesAsync(json) {
    const scope = this
    const images = {}

    let loader

    async function deserializeImage(image) {
      if (typeof image === 'string') {
        const url = image

        const path = /^(\/\/)|([a-z]+:(\/\/)?)/i.test(url)
          ? url
          : scope.resourcePath + url

        return await loader.loadAsync(path)
      } else {
        if (image.data) {
          return {
            data: new TYPED_ARRAYS[image.type](image.data),
            width: image.width,
            height: image.height,
          }
        } else {
          return null
        }
      }
    }

    if (json !== undefined && json.length > 0) {
      loader = new THREE.ImageLoader(this.manager)
      loader.setCrossOrigin(this.crossOrigin)

      for (let i = 0, il = json.length; i < il; i++) {
        const image = json[i]
        if (image === null || image === undefined) {
          continue
        }
        const url = image.url

        if (Array.isArray(url)) {
          // load array of images e.g CubeTexture

          const imageArray = []

          for (let j = 0, jl = url.length; j < jl; j++) {
            const currentUrl = url[j]

            const deserializedImage = await deserializeImage(currentUrl)

            if (deserializedImage !== null) {
              if (deserializedImage instanceof HTMLImageElement) {
                imageArray.push(deserializedImage)
              } else {
                // special case: handle array of data textures for cube textures

                imageArray.push(
                  new THREE.DataTexture(
                    deserializedImage.data,
                    deserializedImage.width,
                    deserializedImage.height
                  )
                )
              }
            }
          }

          images[image.uuid] = new THREE.Source(imageArray)
        } else {
          // load single image

          const deserializedImage = await deserializeImage(image.url)
          images[image.uuid] = new THREE.Source(deserializedImage)
        }
      }
    }

    return images
  }

  parseTextures(json, images) {
    function parseConstant(value, type) {
      if (typeof value === 'number') return value

      console.warn(
        'THREE.ObjectLoader.parseTexture: Constant should be in numeric form.',
        value
      )

      return type[value]
    }

    const textures = {}

    if (json !== undefined) {
      for (let i = 0, l = json.length; i < l; i++) {
        const data = json[i]

        if (data.image === undefined) {
          console.warn(
            'THREE.ObjectLoader: No "image" specified for',
            data.uuid
          )
          continue
        }

        if (images[data.image] === undefined) {
          console.warn('THREE.ObjectLoader: Undefined image', data.image)
          continue
        }

        const source = images[data.image]
        const image = source.data

        let texture

        if (Array.isArray(image)) {
          texture = new THREE.CubeTexture()

          if (image.length === 6) texture.needsUpdate = true
        } else {
          if (image && image.data) {
            texture = new THREE.DataTexture()
          } else {
            texture = new THREE.Texture()
          }

          if (image) texture.needsUpdate = true // textures can have undefined image data
        }

        texture.source = source

        texture.uuid = data.uuid

        if (data.name !== undefined) texture.name = data.name

        if (data.mapping !== undefined)
          texture.mapping = parseConstant(data.mapping, TEXTURE_MAPPING)
        if (data.channel !== undefined) texture.channel = data.channel

        if (data.offset !== undefined) texture.offset.fromArray(data.offset)
        if (data.repeat !== undefined) texture.repeat.fromArray(data.repeat)
        if (data.center !== undefined) texture.center.fromArray(data.center)
        if (data.rotation !== undefined) texture.rotation = data.rotation

        if (data.wrap !== undefined) {
          texture.wrapS = parseConstant(data.wrap[0], TEXTURE_WRAPPING)
          texture.wrapT = parseConstant(data.wrap[1], TEXTURE_WRAPPING)
        }

        if (data.format !== undefined) texture.format = data.format
        if (data.internalFormat !== undefined)
          texture.internalFormat = data.internalFormat
        if (data.type !== undefined) texture.type = data.type
        if (data.colorSpace !== undefined) texture.colorSpace = data.colorSpace

        if (data.minFilter !== undefined)
          texture.minFilter = parseConstant(data.minFilter, TEXTURE_FILTER)
        if (data.magFilter !== undefined)
          texture.magFilter = parseConstant(data.magFilter, TEXTURE_FILTER)
        if (data.anisotropy !== undefined) texture.anisotropy = data.anisotropy

        if (data.flipY !== undefined) texture.flipY = data.flipY

        if (data.generateMipmaps !== undefined)
          texture.generateMipmaps = data.generateMipmaps
        if (data.premultiplyAlpha !== undefined)
          texture.premultiplyAlpha = data.premultiplyAlpha
        if (data.unpackAlignment !== undefined)
          texture.unpackAlignment = data.unpackAlignment
        if (data.compareFunction !== undefined)
          texture.compareFunction = data.compareFunction

        if (data.userData !== undefined) texture.userData = data.userData

        textures[data.uuid] = texture
      }
    }

    return textures
  }

  parseObject(data, geometries, materials, textures, animations) {
    let object

    function getGeometry(name) {
      if (geometries[name] === undefined) {
        console.warn('THREE.ObjectLoader: Undefined geometry', name)
      }

      return geometries[name]
    }

    function getMaterial(name) {
      if (name === undefined) return undefined

      if (Array.isArray(name)) {
        const array = []

        for (let i = 0, l = name.length; i < l; i++) {
          const uuid = name[i]

          if (materials[uuid] === undefined) {
            console.warn('THREE.ObjectLoader: Undefined material', uuid)
          }

          array.push(materials[uuid])
        }

        return array
      }

      if (materials[name] === undefined) {
        console.warn('THREE.ObjectLoader: Undefined material', name)
      }

      return materials[name]
    }

    function getTexture(uuid) {
      if (textures[uuid] === undefined) {
        console.warn('THREE.ObjectLoader: Undefined texture', uuid)
      }

      return textures[uuid]
    }

    let geometry, material

    switch (data.type) {
      case 'Scene':
        object = new THREE.Scene()

        if (data.background !== undefined) {
          if (Number.isInteger(data.background)) {
            object.background = new THREE.Color(data.background)
          } else {
            object.background = getTexture(data.background)
          }
        }

        if (data.environment !== undefined) {
          object.environment = getTexture(data.environment)
        }

        if (data.fog !== undefined) {
          if (data.fog.type === 'Fog') {
            object.fog = new THREE.Fog(
              data.fog.color,
              data.fog.near,
              data.fog.far
            )
          } else if (data.fog.type === 'FogExp2') {
            object.fog = new THREE.FogExp2(data.fog.color, data.fog.density)
          }

          if (data.fog.name !== '') {
            object.fog.name = data.fog.name
          }
        }

        if (data.backgroundBlurriness !== undefined)
          object.backgroundBlurriness = data.backgroundBlurriness
        if (data.backgroundIntensity !== undefined)
          object.backgroundIntensity = data.backgroundIntensity
        if (data.backgroundRotation !== undefined)
          object.backgroundRotation.fromArray(data.backgroundRotation)

        if (data.environmentIntensity !== undefined)
          object.environmentIntensity = data.environmentIntensity
        if (data.environmentRotation !== undefined)
          object.environmentRotation.fromArray(data.environmentRotation)

        break

      case 'PerspectiveCamera':
        object = new THREE.PerspectiveCamera(
          data.fov,
          data.aspect,
          data.near,
          data.far
        )

        if (data.focus !== undefined) object.focus = data.focus
        if (data.zoom !== undefined) object.zoom = data.zoom
        if (data.filmGauge !== undefined) object.filmGauge = data.filmGauge
        if (data.filmOffset !== undefined) object.filmOffset = data.filmOffset
        if (data.view !== undefined) object.view = Object.assign({}, data.view)

        break

      case 'OrthographicCamera':
        object = new THREE.OrthographicCamera(
          data.left,
          data.right,
          data.top,
          data.bottom,
          data.near,
          data.far
        )

        if (data.zoom !== undefined) object.zoom = data.zoom
        if (data.view !== undefined) object.view = Object.assign({}, data.view)

        break

      case 'AmbientLight':
        object = new THREE.AmbientLight(data.color, data.intensity)

        break

      case 'DirectionalLight':
        object = new THREE.DirectionalLight(data.color, data.intensity)
        object.target = data.target || ''

        break

      case 'PointLight':
        object = new THREE.PointLight(
          data.color,
          data.intensity,
          data.distance,
          data.decay
        )

        break

      case 'RectAreaLight':
        object = new THREE.RectAreaLight(
          data.color,
          data.intensity,
          data.width,
          data.height
        )

        break

      case 'SpotLight':
        object = new THREE.SpotLight(
          data.color,
          data.intensity,
          data.distance,
          data.angle,
          data.penumbra,
          data.decay
        )
        object.target = data.target || ''

        break

      case 'HemisphereLight':
        object = new THREE.HemisphereLight(
          data.color,
          data.groundColor,
          data.intensity
        )

        break

      case 'LightProbe':
        object = new THREE.LightProbe().fromJSON(data)

        break

      case 'SkinnedMesh':
        geometry = getGeometry(data.geometry)
        material = getMaterial(data.material)

        object = new THREE.SkinnedMesh(geometry, material)

        if (data.bindMode !== undefined) object.bindMode = data.bindMode
        if (data.bindMatrix !== undefined)
          object.bindMatrix.fromArray(data.bindMatrix)
        if (data.skeleton !== undefined) object.skeleton = data.skeleton

        break

      case 'Mesh':
        geometry = getGeometry(data.geometry)
        material = getMaterial(data.material)

        object = new THREE.Mesh(geometry, material)

        break

      case 'InstancedMesh':
        geometry = getGeometry(data.geometry)
        material = getMaterial(data.material)
        const count = data.count
        const instanceMatrix = data.instanceMatrix
        const instanceColor = data.instanceColor

        object = new THREE.InstancedMesh(geometry, material, count)
        object.instanceMatrix = new THREE.InstancedBufferAttribute(
          new Float32Array(instanceMatrix.array),
          16
        )
        if (instanceColor !== undefined)
          object.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(instanceColor.array),
            instanceColor.itemSize
          )

        break

      case 'BatchedMesh':
        geometry = getGeometry(data.geometry)
        material = getMaterial(data.material)

        object = new THREE.BatchedMesh(
          data.maxInstanceCount,
          data.maxVertexCount,
          data.maxIndexCount,
          material
        )
        object.geometry = geometry
        object.perObjectFrustumCulled = data.perObjectFrustumCulled
        object.sortObjects = data.sortObjects

        object._drawRanges = data.drawRanges
        object._reservedRanges = data.reservedRanges

        object._visibility = data.visibility
        object._active = data.active
        object._bounds = data.bounds.map((bound) => {
          const box = new THREE.Box3()
          box.min.fromArray(bound.boxMin)
          box.max.fromArray(bound.boxMax)

          const sphere = new THREE.Sphere()
          sphere.radius = bound.sphereRadius
          sphere.center.fromArray(bound.sphereCenter)

          return {
            boxInitialized: bound.boxInitialized,
            box: box,

            sphereInitialized: bound.sphereInitialized,
            sphere: sphere,
          }
        })

        object._maxInstanceCount = data.maxInstanceCount
        object._maxVertexCount = data.maxVertexCount
        object._maxIndexCount = data.maxIndexCount

        object._geometryInitialized = data.geometryInitialized
        object._geometryCount = data.geometryCount

        object._matricesTexture = getTexture(data.matricesTexture.uuid)
        if (data.colorsTexture !== undefined)
          object._colorsTexture = getTexture(data.colorsTexture.uuid)

        break

      case 'LOD':
        object = new THREE.LOD()

        break

      case 'Line':
        object = new THREE.Line(
          getGeometry(data.geometry),
          getMaterial(data.material)
        )

        break

      case 'LineLoop':
        object = new THREE.LineLoop(
          getGeometry(data.geometry),
          getMaterial(data.material)
        )

        break

      case 'LineSegments':
        object = new THREE.LineSegments(
          getGeometry(data.geometry),
          getMaterial(data.material)
        )

        break

      case 'PointCloud':
      case 'Points':
        object = new THREE.Points(
          getGeometry(data.geometry),
          getMaterial(data.material)
        )

        break

      case 'Sprite':
        object = new THREE.Sprite(getMaterial(data.material))

        break

      case 'Group':
        object = new THREE.Group()

        break

      case 'Bone':
        object = new THREE.Bone()

        break

      // 粒子对象
      case 'Particle':
        object = ParticleEmitter.fromJSON(data)
        break

      // 广告牌
      case 'Billboard':
        object = Billboard.fromJSON({
          material: getMaterial(data.material),
          options: data.options,
        })
        break

      // HtmlPanel
      case 'HtmlPanel':
        object = HtmlPanel.fromJSON(data)
        break

      // HtmlSprite
      case 'HtmlSprite':
        object = HtmlSprite.fromJSON(data)
        break

      // 3DTiles
      case 'TilesGroup':
        if (!data.options) {
          object = new THREE.Object3D()
          break
        }

        data.children = undefined

        object = Tiles.fromJSON(data, false)
        break

      default:
        object = new THREE.Object3D()
    }

    this.copyAttrByData(
      object,
      data,
      geometries,
      materials,
      textures,
      animations
    )

    return object
  }

  copyAttrByData(
    object,
    data,
    geometries = {},
    materials = {},
    textures = {},
    animations = {}
  ) {
    object.uuid = data.uuid

    if (data.name !== undefined) object.name = data.name

    if (data.matrix !== undefined) {
      object.matrix.fromArray(data.matrix)

      if (data.matrixAutoUpdate !== undefined)
        object.matrixAutoUpdate = data.matrixAutoUpdate
      if (object.matrixAutoUpdate)
        object.matrix.decompose(
          object.position,
          object.quaternion,
          object.scale
        )
    } else {
      if (data.position !== undefined) object.position.fromArray(data.position)
      if (data.rotation !== undefined) object.rotation.fromArray(data.rotation)
      if (data.quaternion !== undefined)
        object.quaternion.fromArray(data.quaternion)
      if (data.scale !== undefined) object.scale.fromArray(data.scale)
    }

    if (data.up !== undefined) object.up.fromArray(data.up)

    if (data.castShadow !== undefined) object.castShadow = data.castShadow
    if (data.receiveShadow !== undefined)
      object.receiveShadow = data.receiveShadow

    if (data.shadow) {
      if (data.shadow.intensity !== undefined)
        object.shadow.intensity = data.shadow.intensity
      if (data.shadow.bias !== undefined) object.shadow.bias = data.shadow.bias
      if (data.shadow.normalBias !== undefined)
        object.shadow.normalBias = data.shadow.normalBias
      if (data.shadow.radius !== undefined)
        object.shadow.radius = data.shadow.radius
      if (data.shadow.mapSize !== undefined)
        object.shadow.mapSize.fromArray(data.shadow.mapSize)
      if (data.shadow.camera !== undefined)
        object.shadow.camera = this.parseObject(data.shadow.camera)
    }

    if (data.visible !== undefined) object.visible = data.visible
    if (data.frustumCulled !== undefined)
      object.frustumCulled = data.frustumCulled
    if (data.renderOrder !== undefined) object.renderOrder = data.renderOrder
    if (data.userData !== undefined) object.userData = data.userData
    if (data.layers !== undefined) object.layers.mask = data.layers

    if (data.children !== undefined) {
      const children = data.children

      for (let i = 0; i < children.length; i++) {
        object.add(
          this.parseObject(
            children[i],
            geometries,
            materials,
            textures,
            animations
          )
        )
      }
    }

    if (data.animations !== undefined) {
      const objectAnimations = data.animations

      for (let i = 0; i < objectAnimations.length; i++) {
        const uuid = objectAnimations[i]

        object.animations.push(animations[uuid])
      }
    }

    if (data.type === 'LOD') {
      if (data.autoUpdate !== undefined) object.autoUpdate = data.autoUpdate

      const levels = data.levels

      for (let l = 0; l < levels.length; l++) {
        const level = levels[l]
        const child = object.getObjectByProperty('uuid', level.object)

        if (child !== undefined) {
          object.addLevel(child, level.distance, level.hysteresis)
        }
      }
    }
  }

  bindSkeletons(object, skeletons) {
    if (Object.keys(skeletons).length === 0) return

    object.traverse(function (child) {
      if (child.isSkinnedMesh === true && child.skeleton !== undefined) {
        const skeleton = skeletons[child.skeleton]

        if (skeleton === undefined) {
          console.warn(
            'THREE.ObjectLoader: No skeleton found with UUID:',
            child.skeleton
          )
        } else {
          child.bind(skeleton, child.bindMatrix)
        }
      }
    })
  }

  bindLightTargets(object) {
    object.traverse(function (child) {
      if (child.isDirectionalLight || child.isSpotLight) {
        const uuid = child.target

        const target = object.getObjectByProperty('uuid', uuid)

        if (target !== undefined) {
          child.target = target
        } else {
          child.target = new THREE.Object3D()
        }
      }
    })
  }
}

export { ObjectLoader }
