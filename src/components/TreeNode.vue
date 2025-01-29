<template>
  <g :transform="transform">
    <!-- ノードの四角形 -->
    <rect
      :x="-(nodeWidth / 2)"
      :y="-nodeHeight / 2"
      :width="nodeWidth"
      :height="nodeHeight"
      fill="lightblue"
      @click="selectNode"
    />

    <!-- テキスト部分（ダブルクリックで編集） -->
    <text
      v-if="!isEditing"
      :x="0"
      :y="getTextY"
      text-anchor="middle"
      dominant-baseline="central"
      @dblclick="startEditing"
      ref="textElement"
    >
    <tspan 
      v-for="(line, index) in formatLabel(node.label).split('\n')" 
      :x="0" 
      :dy="index === 0 ? 0 : '1.2em'" 
      :key="index"
    >
      {{ line }}
    </tspan>
    </text>

    <!-- 編集モードのinput -->
    <foreignObject v-if="isEditing" :x="-(nodeWidth / 2)" :y="-20" :width="nodeWidth" :height="40">
      <input
        type="text"
        v-model="editableLabel"
        @blur="saveLabel"
        @keydown.enter="saveLabel"
      />
    </foreignObject>

    <!-- +ボタンをノードの真下に表示 -->
    <foreignObject
      :x="-(nodeWidth / 2)"
      :y="nodeHeight / 2 - 2"
      :width="nodeWidth"
      height="15"
      >
        <button @click.stop="addChild" class="custom-button">+</button>
    </foreignObject>

    <!-- -ボタンをノードの真上に表示 -->
    <foreignObject
      v-if="node.parentId"
      :x="-(nodeWidth / 2)"
      :y="-(nodeHeight / 2) - 11"
      :width="nodeWidth"
      height="15"
    >
      <button @click.stop="deleteNode" class="custom-button">-</button>
    </foreignObject>
  </g>
</template>

<script>
export default {
  name: 'TreeNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    x: Number,
    y: Number,
    isSelected: Boolean,
  },
  data() {
    return {
      isEditing: false, // 編集状態
      editableLabel: this.node.label, // 編集中のラベル
      nodeWidth: 110, // 初期幅（最低幅）
      nodeHeight: 40, // 高さ
    };
  },
  watch: {
    'node.label': function () {
      this.$nextTick(() => {
        this.updateNodeDimensions();
      });
    },
  },
  computed: {
    transform() {
      return `translate(${this.x}, ${this.y})`;
    },
    getTextY() {
      const lineCount = this.getLineCount(this.node.label);
      const offset = (lineCount - 1) * 10; // 1行増えるごとに10px上へ
      return -offset;
    }
  },
  methods: {
    selectNode() {
      this.$emit('select', this.node);
    },
    startEditing() {
      this.isEditing = true;
      this.editableLabel = this.node.label;
    },
    saveLabel() {
      this.isEditing = false;
      if (this.editableLabel !== this.node.label) {
        this.$emit('update-label', { id: this.node.id, label: this.editableLabel });
      }
      this.updateNodeDimensions(); // 保存時に幅を更新
    },
    addChild() {
      this.$emit('add-child', this.node);
    },
    deleteNode() {
      this.$emit('delete-node', this.node); // 削除イベントを親に通知
    },
    updateNodeDimensions() {
      this.$nextTick(() => {
        const textElement = this.$refs.textElement;
        if (textElement) {
          setTimeout(() => {
            const textHeight = textElement.getBBox().height;
            // ノードの高さをテキストの高さ + 余白20pxで調整
            this.nodeHeight = textHeight + 20; 
            
            // ノードの中心がずれないように調整
            this.nodeYOffset = -(this.nodeHeight / 2); 
          }, 10);
        }
      });
    },
    formatLabel(label) {
      const chunkSize = 7;
      const regex = new RegExp(`.{1,${chunkSize}}`, 'g');
      return label.match(regex).join('\n');
    },
    getLineCount(label) {
      return this.formatLabel(label).split('\n').length;
    },
  },
  mounted() {
    this.updateNodeDimensions();
  },
  updated() {
    this.updateNodeDimensions();
  },
};
</script>

<style scoped>
rect {
  cursor: pointer;
}
.custom-button {
  color: white;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  background-color: lightblue;
  border: none;
  border-radius: 4px; /* 角丸を少しだけ追加 */
  width: 100%;
  height: 100%;
  display: flex; /* フレックスボックスを使用して配置 */
  justify-content: center; /* 水平方向中央揃え */
  align-items: center; /* 垂直方向中央揃え */
  text-align: center; /* テキストを中央揃え */
}
.custom-button:hover {
  background-color: deepskyblue; /* ホバー時の色 */
}
input {
  width: 100%;
  padding: 5px;
  font-size: 14px;
}
</style>