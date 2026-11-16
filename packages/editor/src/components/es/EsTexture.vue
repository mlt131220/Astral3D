<script lang="ts" setup>
import {ref, onMounted, watch,nextTick} from "vue";
import type {UploadFileInfo} from 'naive-ui';
import * as THREE from 'three';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Loader } from "@astral3d/engine";

const props = withDefaults(defineProps<{
  texture: THREE.Color | THREE.Texture | THREE.CubeTexture | null,
  mapping?: THREE.Mapping,
  width?: string,
  height?: string,
  disabled?: boolean
}>(),{
  texture: null,
  mapping:THREE.Texture.DEFAULT_MAPPING,
  width: "2rem",
  height: "2rem",
  disabled:false
})

const emits = defineEmits(["update:texture", "change"]);

watch(() => props.texture, () => {
  if(!props.texture) return;

  setValue(props.texture)
})

const cache = new Map();

const file = ref<UploadFileInfo[]>([]);
const uploadRef = ref();
const canvasRef = ref();

onMounted(async () => {
  await nextTick();

  if(props.texture){
    setValue(props.texture)
  }

  canvasRef.value.addEventListener('drop', function (event) {
    event.preventDefault();
    event.stopPropagation();
    loadFile(event.dataTransfer.files[0]);
  });
})

function updateFileList(fList: UploadFileInfo[]) {
  //永远取最新值
  file.value = [fList[fList.length - 1]];

  file.value[0].file !== null && loadFile(file.value[0].file as File);
}

function canvasClick() {
  if(props.disabled) return;

  //uploadRef.value.clear();
  uploadRef.value.openOpenFileDialog();
}

function setValue(newTexture) {
  const context = canvasRef.value.getContext('2d');

  // 如果画布不可见，则上下文似乎可以为空
  if (context) {
    // 始终在设置新纹理之前清除上下文，因为新纹理可能具有透明度
    context.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  }

  if (newTexture !== null) {
    const image = newTexture.image;
    if (image && image.width > 0) {
      const scale = canvasRef.value.width / image.width;

      if ( newTexture.isDataTexture || newTexture.isCompressedTexture ) {
        const canvas2 = renderToCanvas(newTexture);
        context.drawImage( canvas2, 0, 0, image.width * scale, image.height * scale );
      } else {
        context.drawImage( image, 0, 0, image.width * scale, image.height * scale );
      }
    } else {
      canvasRef.value.title = newTexture.sourceFile + ' (error)';
    }

    if (file.value.length === 0) {
      file.value = [newTexture];
    }

    emits("update:texture", newTexture);
  } else {
    canvasRef.value.title = 'empty';
    uploadRef.value.clear();
    file.value = [];
  }
}

function loadFile(file) {
  //文件后缀
  const extension = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  const hash = `${file.lastModified}_${file.size}_${file.name}`;

  if (cache.has(hash)) {
    const texture = cache.get(hash);

    setValue(texture);
    emits("change", texture);
  } else if (extension === 'hdr' || extension === 'pic') {
    reader.addEventListener('load', function (event) {
      // 假设RGBE/Radiance HDR图像格式
      const loader = new HDRLoader();
      loader.load(event.target?.result as string, function (hdrTexture) {
        // @ts-ignore
        hdrTexture.sourceFile = file.name;

        cache.set(hash, hdrTexture);

        setValue(hdrTexture);
        emits("change", hdrTexture);
      });
    });

    reader.readAsDataURL(file);
  } else if (extension === 'tga') {
    reader.addEventListener('load', function (event) {
      const loader = new TGALoader();
      loader.load(event.target?.result as string, ( texture ) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        // @ts-ignore
        texture.sourceFile = file.name;

        cache.set(hash, texture);

        setValue(texture);
        emits("change", texture);
      });
    }, false);

    reader.readAsArrayBuffer(file);
  } else if (extension === 'ktx2') {
    reader.addEventListener( 'load', function ( event ) {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const blobURL = URL.createObjectURL( new Blob([arrayBuffer]) );
      const ktx2Loader =  Loader.ktx2Loader;

      ktx2Loader.load(blobURL, function ( texture ) {
        texture.colorSpace = THREE.SRGBColorSpace;
        // @ts-ignore
        texture.sourceFile = file.name;
        texture.needsUpdate = true;

        cache.set(hash, texture);

        setValue( texture );
        emits("change", texture);
        ktx2Loader.dispose();
      });
    });

    reader.readAsArrayBuffer(file);
  }else if (file.type.match('image.*')) {
    reader.addEventListener('load', function (event) {
      const image = document.createElement('img');
      image.addEventListener('load', function () {
        const texture = new THREE.Texture(this, props.mapping);
        // @ts-ignore
        texture.sourceFile = file.name;
        texture.needsUpdate = true;

        cache.set(hash, texture);

        setValue(texture);
        emits("change", texture);
      }, false);

      image.src = event.target?.result as string;
    }, false);
    reader.readAsDataURL(file);
  }else if(extension === 'exr'){
    reader.addEventListener( 'load', ( event ) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const blobURL = URL.createObjectURL(new Blob([arrayBuffer]));

      Loader.exrLoader.load(blobURL, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        // @ts-ignore
        texture.sourceFile = file.name;

        cache.set(hash, texture);

        setValue(texture);
        emits("change", texture);
      });
    });

    reader.readAsArrayBuffer(file);

  }
}

function setColorSpace(colorSpace: string) {
  if (props.texture && !(props.texture instanceof THREE.Color)) {
    props.texture.colorSpace = colorSpace;
  }
}

let renderer;

function renderToCanvas(texture) {
  if (renderer === undefined) {
    renderer = new THREE.WebGLRenderer();
  }

  const image = texture.image;
  renderer.setSize(image.width, image.height, false);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.MeshBasicMaterial({map: texture});
  const quad = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(quad, material);
  scene.add(mesh);
  renderer.render(scene, camera);
  return renderer.domElement;
}

defineExpose({
  setColorSpace, setValue
})
</script>

<template>
  <div class="es-texture">
    <n-upload list-type="image-card" ref="uploadRef" v-show="file.length === 0" @update:file-list="updateFileList" :disabled="disabled" />
    <canvas class="es-texture-canvas" ref="canvasRef" v-show="file.length === 1" @click="canvasClick()" title="Texture"></canvas>
  </div>
</template>

<style lang="less" scoped>
:deep(.n-upload) {
  .n-upload-trigger.n-upload-trigger--image-card,
  .n-upload-file--image-card-type {
    width: v-bind(width);
    height: v-bind(height);
  }
}

.es-texture {
  width: v-bind(width);
  height: v-bind(height);

  &-canvas {
    width: v-bind(width);
    height: v-bind(height);
    cursor: pointer;
  }
}
</style>
