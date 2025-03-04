<script setup>
import LogicTree from './components/LogicTree.vue';
import NavigationWindow from './components/NavigationWindow.vue';
import { ref, nextTick } from 'vue'; // nextTickをインポート

const layoutDirection = ref('horizotal'); // レイアウト方向 ('vertical' = 上下, 'horizontal' = 左右)
const logicTreeRef = ref(null); // LogicTreeの参照を管理

// レイアウトの方向を切り替える
const toggleLayoutDirection = () => {
  layoutDirection.value = layoutDirection.value === 'vertical' ? 'horizontal' : 'vertical';

  // DOM更新後にarrangeNodesを呼び出す
  nextTick(() => {
    if (logicTreeRef.value) {
      logicTreeRef.value.arrangeNodes(logicTreeRef.value.nodes);
    }
  });
};
const exportData = () => {
  const dataStr = JSON.stringify(nodes.value, null, 2);
  navigator.clipboard.writeText(dataStr)
    .then(() => showNotification('データをコピーしました！'))
    .catch(() => showNotification('コピーに失敗しました'));
};

const importData = async () => {
  try {
    const dataStr = await navigator.clipboard.readText();
    nodes.value = JSON.parse(dataStr);
    showNotification('データを貼り付けました！');
  } catch {
    showNotification('データの貼り付けに失敗しました');
  }
};
// 初期ノードデータ
const nodes = ref([
  { id: '1', label: 'Root', x: 400, y: 50, parentId: null, color: "lightblue" }
]);

const globalNodeCounter = ref(2);
const selectedNode = ref(null);
const isNavVisible = ref(false); // ナビゲーションウィンドウの表示状態

// ノードを選択する
const selectNode = (node) => {
  console.log('Selected node:', node);
  selectedNode.value = node;
};

// ツリーの更新
const updateTree = (newNodes) => {
  console.log('Tree updated:', newNodes);
  nodes.value = newNodes;
};

// ノードのラベルを更新
const updateLabel = ({ id, label }) => {
  const node = nodes.value.find(node => node.id === id);
  if (node) {
    node.label = label;
  }
};

// ナビゲーションウィンドウの表示切り替え
// const toggleNavVisibility = () => {
//   isNavVisible.value = !isNavVisible.value;
// };

const notification = ref('');

// 一時的な通知を表示
const showNotification = (message) => {
  notification.value = message;
  setTimeout(() => {
    notification.value = '';
  }, 2000); // 2秒後に消える
};

</script>

<template>
  <div style="position: fixed; top: 8px; left: 50%; transform: translateX(-50%); z-index: 2000;">
    <div v-if="notification" class="notification">
      {{ notification }}
    </div>
  </div>
  <div style="display: flex; height: 100vh; width: 100vw; padding: 0; overflow: hidden;">
    <button @click="exportData" style="position: fixed; top: 8px; left: 10px; z-index: 1000;">
      コピー
    </button>
    <button @click="importData" style="position: fixed; top: 8px; left: 80px; z-index: 1000;">
      貼り付け
    </button>
    <!-- 上下/左右切り替えボタン -->
    <button @click="toggleLayoutDirection" style="position: fixed; top: 8px; left: 170px; z-index: 1000;">
      {{ layoutDirection === 'vertical' ? '縦' : '横' }}
    </button>
    <!-- <button @click="logicTreeRef.value.resetZoom()" style="position: fixed; top: 8px; left: 238.5px; z-index: 1000;">
      全体表示
    </button> -->
    <!-- ロジックツリー -->
    <div
      :style="{
        flex: isNavVisible ? '8' : '1',
        width: isNavVisible ? '80%' : '100%',
        borderRight: isNavVisible ? '1px solid #ccc' : 'none',
        padding: 0,
        overflow: 'hidden',
        transform: isNavVisible ? 'scale(1)' : 'scale(1.2)', // 20%拡大
        transformOrigin: '50% 0%' // 拡大基準点
      }"
    >
      <LogicTree
        ref="logicTree"
        :nodes="nodes"
        :selectedNode="selectedNode"
        :layoutDirection="layoutDirection"
        @select-node="selectNode"
        :globalNodeCounter="globalNodeCounter"
        @update-tree="updateTree"
        @update-label="updateLabel"
      />
    </div>

    <!-- ナビゲーションウィンドウ
    <div
      v-if="isNavVisible"
      style="flex: 2; padding: 10px; overflow-y: auto;"
    >
      <NavigationWindow
        :nodes="nodes"
        @select-node="selectNode"
        @update-label="updateLabel"
      />
    </div> -->

    <!-- トグルボタン -->
    <!-- <button
      @click="toggleNavVisibility"
      style="position: absolute; top: 10px; right: 10px; z-index: 1000;"
    >
      {{ isNavVisible ? '⇒' : '⇐' }}
    </button> -->
  </div>
</template>

<style scoped>
#app {
  padding: 0;
}
button {
  background-color: lightblue;
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
}
</style>