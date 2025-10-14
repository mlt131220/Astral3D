import { Group, BufferGeometryLoader, Mesh } from 'three'
import { Viewport } from '#/core/preview/Viewport.ts'
import GenerateColliderEnvironmentWorkerUrl from './generateColliderEnvironment.worker.js?worker&url'

export class GenerateColliderEnvironmentWorker {
  constructor() {
    this.worker = new Worker(GenerateColliderEnvironmentWorkerUrl, {
      type: 'module',
    })
    this.worker.onerror = (e) => {
      if (e.message) {
        throw new Error(
          `GenerateColliderEnvironmentWorker: Could not create Web Worker with error "${e.message}"`
        )
      } else {
        throw new Error(
          `GenerateColliderEnvironmentWorker: Could not create Web Worker.`
        )
      }
    }
  }

  parseAttr(attr, gArray) {
    // 遍历attr的key,还原
    for (const key in attr) {
      const item = attr[key]
      if (item.array) {
        item.array = gArray[key].array
        item.count = gArray[key].count
        item.itemSize = gArray[key].itemSize
      }
    }
  }

  generate(scene) {
    if (this.worker === null) {
      throw new Error(
        'GenerateColliderEnvironmentWorker: Worker has been disposed.'
      )
    }

    const { worker } = this
    const dbTable = 'environment'

    return new Promise(async (resolve, reject) => {
      worker.onerror = (e) => {
        reject(new Error(`GenerateColliderEnvironmentWorker: ${e.message}`))
      }

      // 按照材质分组mesh
      let toMerge = {},
        keys = []

      const loader = new BufferGeometryLoader()

      const db = window.VIEWPORT.modules['db']
      const has = await db.hasStore(dbTable)
      if (has) {
        // TODO 此处应该直接读取返回
        //db.clear(dbTable);
      } else {
        await db.addStore(dbTable)
      }

      let environment = new Group()
      environment.name = 'ROAMING-ColliderEnvironment'

      worker.onmessage = ({ data }) => {
        switch (data.type) {
          case 'env':
            const geoJson = data.geometryJson
            const geometry = loader.parse(geoJson)

            const newMesh = new Mesh(
              geometry,
              window.BOM3D.materials[data.materialUuid]
            )
            newMesh.castShadow = true
            newMesh.receiveShadow = true
            newMesh.material.shadowSide = 2

            environment.add(newMesh)
            break
          case 'collider':
            const mergedGeometryJson = data.mergedGeometryJson
            const mergedGeometry = loader.parse(mergedGeometryJson)

            this.parseAttr(mergedGeometry.attributes, data.gArray)
            mergedGeometry.index.array = data.gArray.index.array
            mergedGeometry.index.itemSize = data.gArray.index.itemSize

            resolve({ mergedGeometry, environment })

            worker.onmessage = null
            break
        }
      }

      scene.traverse((c) => {
        // @ts-ignore 只合并网格
        if (c.isMesh) {
          // @ts-ignore
          let uuid
          // @ts-ignore
          if (c.material.uuid === Viewport.RegularMat.uuid) {
            uuid = c.userData.old.materialUuid
          } else {
            // @ts-ignore
            uuid = c.material.uuid
          }

          toMerge[uuid] = toMerge[uuid] || []
          let mesh = c.clone()
          mesh.material = undefined

          // if (mesh.material?.map === null || !mesh.material?.map?.isTexture) {
          //     // 材质不存在贴图则删除uv属性
          //     mesh.geometry.deleteAttribute("uv");
          // }

          const json = mesh.toJSON()
          json.matrixWorld = c.matrixWorld.toArray()
          toMerge[uuid].push(json)
        }
      })
      keys = Object.keys(toMerge)

      const num = new Proxy(
        { value: keys.length },
        {
          set(target, p, newValue, receiver) {
            target[p] = newValue

            if (newValue === 0) {
              toMerge = undefined

              worker.postMessage({
                indexedDBName: 'BOM',
                table: dbTable,
                uuids: [...keys],
              })
            }

            return true
          },
        }
      )

      keys.forEach((uuid) => {
        db.setItem(uuid, toMerge[uuid], dbTable).then(() => {
          num.value--
        })
      })
    })
  }
}
