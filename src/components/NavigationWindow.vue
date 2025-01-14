<template>
  <div class="navigation-window">
    <ul>
      <li v-for="node in orderedNodes" :key="node.id">
        <!-- ラベル表示 (ダブルクリックで編集モードに入る) -->
        <span
          v-if="!isEditing(node)"
          @dblclick="startEditing(node)"
          :style="{ paddingLeft: getIndentation(node) + 'em' }"
          @click="selectNode(node)"
        >
          {{ node.label }}
        </span>

        <!-- 編集モード -->
        <input
          v-else
          type="text"
          v-model="editableLabels[node.id]"
          @blur="saveLabel(node)"
          @keydown.enter="saveLabel(node)"
          :style="{ paddingLeft: getIndentation(node) + 'em' }"
        />
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'NavigationWindow',
  props: {
    nodes: {
      type: Array,
      required: true,
    },
    selectedNode: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      editingNodeId: null, // 編集中のノードID
      editableLabels: {}, // 編集中のラベルを保持
    };
  },
  computed: {
    orderedNodes() {
      // ノードをツリー構造に従って整列
      const sortNodes = (nodes, parentId = null, depth = 0) => {
        return nodes
          .filter(node => node.parentId === parentId)
          .reduce((acc, node) => {
            node.depth = depth;
            return [...acc, node, ...sortNodes(nodes, node.id, depth + 1)];
          }, []);
      };
      return sortNodes(this.nodes);
    },
  },
  methods: {
    selectNode(node) {
      this.$emit('select-node', node); // 親コンポーネントに選択を通知
    },
    isEditing(node) {
      return this.editingNodeId === node.id;
    },
    startEditing(node) {
      this.editingNodeId = node.id;
      this.editableLabels[node.id] = node.label;

      // ロジックツリーのノードも編集モードに
      this.$emit('start-editing-node', node);
    },
    saveLabel(node) {
      const newLabel = this.editableLabels[node.id];
      if (node.label !== newLabel) {
        this.$emit('update-label', { id: node.id, label: newLabel });
      }

      this.editingNodeId = null; // 編集モード終了

      // ロジックツリーの編集モードも終了
      this.$emit('stop-editing-node', node);
    },
    getIndentation(node) {
      return node.depth || 0; // 階層に応じたインデント
    },
    deleteNode(node) {
      this.$emit('delete-node', node); // 親コンポーネントに削除を通知
    },
  },
};
</script>

<style scoped>
.navigation-window {
  width: 100%;
  overflow-y: auto;
  border-left: 1px solid #ccc;
  padding: 0;
  text-align: left;
  font-family: Arial, sans-serif;
  background-color: #f9f9f9;
}

.navigation-window ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.navigation-window li {
  margin: 5px 0;
}

.navigation-window span,
.navigation-window input {
  cursor: pointer;
  color: #007bff;
}

.navigation-window span:hover {
  text-decoration: underline;
}

.navigation-window input {
  width: auto;
  display: inline-block;
  border: none;
  border-bottom: 1px solid #ccc;
}
</style>
