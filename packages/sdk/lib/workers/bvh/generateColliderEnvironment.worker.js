import { Group, Mesh, MeshBasicMaterial, Matrix4, InstancedMesh } from 'three'
import { ObjectLoader } from '#/core/loader/ObjectLoader'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { StaticGeometryGenerator } from 'three-mesh-bvh'
import { TYPED_ARRAYS } from '../../../config/global'
import DBStorage from '../../../core/utils/DBStorage'

/**
 * 解析attr
 * @param attr Geometry Attributes
 */
function parseAttr(attr) {
  // 遍历attr的key,组织为新对象返回
  const newAttr = {}
  for (const key in attr) {
    const item = attr[key]
    if (item.array) {
      newAttr[key] = {
        itemSize: item.itemSize,
        array: item.array,
        count: item.count,
      }
      item.array = new TYPED_ARRAYS[item.array.constructor.name]([])
    }
  }

  return newAttr
}

let basicMaterial = new MeshBasicMaterial()

function getMeshByInstancedMesh(instancedMesh) {
  const meshes = []

  const matrixWorld = instancedMesh.matrixWorld
  const count = instancedMesh.count

  for (let instanceId = 0; instanceId < count; instanceId++) {
    const _mesh = new Mesh()
    const _instanceLocalMatrix = new Matrix4()
    const _instanceWorldMatrix = new Matrix4()

    _mesh.geometry = instancedMesh.geometry
    _mesh.material = instancedMesh.material

    // 计算每个实例的世界矩阵
    instancedMesh.getMatrixAt(instanceId, _instanceLocalMatrix)

    _instanceWorldMatrix.multiplyMatrices(matrixWorld, _instanceLocalMatrix)

    // 网格表示这个单一实例
    _mesh.matrixWorld = _instanceWorldMatrix

    meshes.push(_mesh)
  }

  return meshes
}

onmessage = async function ({ data }) {
  const { indexedDBName, table, uuids } = data
  let loader = new ObjectLoader()

  let environment = new Group()

  const db = new DBStorage(indexedDBName, table)

  for (const uuid of uuids) {
    const arr = await db.getItem(uuid)

    const visualGeometries = []
    arr.forEach((meshJson) => {
      const m = new Matrix4()
      const matrixWorld = m.fromArray(meshJson.matrixWorld)

      meshJson.matrixWorld = undefined
      const mesh = loader.parse(meshJson)

      const cloneGeom = (me) => {
        const geom = me.geometry.clone()
        geom.applyMatrix4(me.matrixWorld)
        visualGeometries.push(geom)
      }

      // @ts-ignore
      if (!mesh.isInstancedMesh) {
        cloneGeom(mesh)
      } else {
        const meshes = getMeshByInstancedMesh(mesh)
        meshes.forEach((m) => {
          cloneGeom(m)
        })
      }
    })

    if (visualGeometries.length) {
      const newGeom = BufferGeometryUtils.mergeGeometries(visualGeometries)
      let n_geo = newGeom.clone().toJSON()

      const newMesh = new Mesh(newGeom, basicMaterial)
      environment.add(newMesh)

      postMessage({
        type: 'env',
        materialUuid: uuid,
        geometryJson: n_geo,
      })

      n_geo = undefined
    }

    await db.removeItem(uuid)
  }

  const staticGenerator = new StaticGeometryGenerator(environment)
  staticGenerator.attributes = ['position']

  const mergedGeometry = staticGenerator.generate()

  const gArray = {
    ...parseAttr(mergedGeometry.attributes),
    index: {
      array: mergedGeometry.index.array,
      itemSize: mergedGeometry.index.itemSize,
    },
  }
  mergedGeometry.index.array = new TYPED_ARRAYS[
    gArray.index.array.constructor.name
  ]([])

  const mergedGeometryJson = mergedGeometry.toJSON()

  const transfer = Object.values(gArray).map(
    (arrayBuffer) => arrayBuffer.array.buffer
  )
  postMessage(
    {
      type: 'collider',
      mergedGeometryJson: mergedGeometryJson,
      gArray: gArray,
    },
    transfer
  )

  basicMaterial = undefined
  environment = undefined
}
