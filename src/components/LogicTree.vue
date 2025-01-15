<template>
  <div class="logic-tree">
    <svg :width="svgWidth" :height="svgHeight" ref="svgElement">
      <!-- スケールと中央揃えを適用 -->
      <g :transform="`translate(${offsetX}, ${offsetY}) scale(${scale})`">
        <!-- ノード間の線を描画 -->
        <line
          v-for="node in nodes"
          :key="'line-' + node.id"
          :x1="getNode(node.parentId)?.x || node.x || 0"
          :y1="getNode(node.parentId)?.y || node.y || 0"
          :x2="node.x || 0"
          :y2="node.y || 0"
          stroke="black"
          stroke-width="2"
        />
        <!-- ノードを描画 -->
        <TreeNode
          v-for="node in nodes"
          :key="node.id"
          :node="node"
          :x="node.x"
          :y="node.y"
          :isSelected="node === selectedNode"
          :isEditing="node.id === editingNodeId"
          @select="selectNode"
          @add-child="addChildNode"
          @update-label="updateNodeLabel"
          @delete-node="deleteNode"
        />
      </g>
    </svg>
  </div>
</template>

<script>
import TreeNode from './TreeNode.vue';

export default {
  components: { TreeNode },
  props: ['nodes', 'selectedNode', 'editingNodeId', 'layoutDirection'],
  emits: ['select-node', 'update-tree', 'update-label',],
  data() {
    return {
      globalNodeCounter: 1,
      baseY: 50,
      nodeSpacingY: 120,
      nodeSpacingX: 120,
      svgWidth: 0,
      svgHeight: window.innerHeight,
      scale: 1, // ツリーのスケール値
      offsetX: 0, // 中央揃え用Xオフセット
      offsetY: 0, // 中央揃え用Yオフセット
      padding: 20, // 余白 (px)
    };
  },
  mounted() {
    this.updateSVGWidth();
    window.addEventListener('resize', this.updateSVGWidth);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.updateSVGWidth);
  },
  methods: {
    calculateRequiredWidth(node, nodes) {
      if (!node) return 0;
      const children = nodes.filter(n => n.parentId === node.id);
      if (children.length === 0) {
        return this.nodeSpacingX;
      }
      return children.reduce((total, child) => total + this.calculateRequiredWidth(child, nodes), 0);
    },
    calculateNodePositions(node, nodes, primary, depth) {
      if (!node) return;
      const children = nodes.filter(n => n.parentId === node.id);
      if (children.length === 0) {
        if (this.layoutDirection === 'vertical') {
          node.x = primary;
          node.y = this.baseY + depth * this.nodeSpacingY;
        } else {
          node.x = this.baseY + depth * this.nodeSpacingX;
          node.y = primary;
        }
        return;
      }

      const totalWidth = children.reduce(
        (total, child) => total + this.calculateRequiredWidth(child, nodes),
        0
      );

      let currentPrimary = primary - totalWidth / 2;
      children.forEach(child => {
        const childWidth = this.calculateRequiredWidth(child, nodes);
        this.calculateNodePositions(child, nodes, currentPrimary + childWidth / 2, depth + 1);
        currentPrimary += childWidth;
      });

      if (this.layoutDirection === 'vertical') {
        node.x = primary;
        node.y = this.baseY + depth * this.nodeSpacingY;
      } else {
        node.x = this.baseY + depth * this.nodeSpacingX;
        node.y = primary;
      }
    },
    arrangeNodes(nodes) {
      const rootNode = nodes.find(node => node.parentId === null);
      if (!rootNode) return;
      this.calculateNodePositions(rootNode, nodes, this.svgWidth / 2, 0);
      this.$emit('update-tree', [...nodes]);
      this.updateScale(); // スケールを更新
    },
    updateSVGWidth() {
      const svgContainer = this.$refs.svgElement.parentElement;
      this.svgWidth = svgContainer.clientWidth;
      this.arrangeNodes(this.nodes);
    },
    updateScale() {
      // ノードの最小・最大座標を取得
      const minX = Math.min(...this.nodes.map(node => node.x || 0));
      const maxX = Math.max(...this.nodes.map(node => node.x || 0));
      const minY = Math.min(...this.nodes.map(node => node.y || 0));
      const maxY = Math.max(...this.nodes.map(node => node.y || 0));

      // 必要な幅と高さを計算し、余白を追加
      const treeWidth = maxX - minX + this.nodeSpacingX + this.padding * 2;
      const treeHeight = maxY - minY + this.nodeSpacingY + this.padding * 2;

      // 画面の幅と高さに合わせてスケールを計算
      const availableWidth = this.svgWidth - this.padding * 2;
      const scaleX = availableWidth / treeWidth;
      const scaleY = this.svgHeight / treeHeight;

      this.scale = Math.min(scaleX, scaleY, 1); // スケールは1以下に限定

      // 中央揃え用のオフセットを計算 (余白を含める)
      this.offsetX = this.padding + (availableWidth - treeWidth * this.scale) / 2 - minX * this.scale + 12;
      this.offsetY = this.padding + (this.svgHeight - treeHeight * this.scale) / 2 - minY * this.scale;
    },
    addChildNode(parentNode) {
      const newNode = {
        id: this.globalNodeCounter.toString(),
        label: `ノード${this.globalNodeCounter}`,
        x: parentNode.x,
        y: parentNode.y + this.nodeSpacingY,
        parentId: parentNode.id,
      };
      this.globalNodeCounter++;
      const updatedNodes = [...this.nodes, newNode];
      this.arrangeNodes(updatedNodes);
    },
    getNode(nodeId) {
      return this.nodes.find(node => node.id === nodeId) || null;
    },
    selectNode(node) {
      this.$emit('select-node', node);
    },
    updateNodeLabel({ id, label }) {
      const targetNode = this.nodes.find(node => node.id === id);
      if (targetNode) {
        targetNode.label = label;
        this.arrangeNodes([...this.nodes]);
      }
    },
    deleteNode(targetNode) {
      // 削除対象ノードとその子ノードをすべて削除
      const deleteNodeRecursively = (nodeId, nodes) => {
        return nodes.filter(node => node.id !== nodeId && node.parentId !== nodeId);
      };

      // ノードリストを更新し、削除を反映
      const updatedNodes = deleteNodeRecursively(targetNode.id, this.nodes);
      this.$emit('update-tree', updatedNodes); // ナビゲーションにも通知
      this.arrangeNodes(updatedNodes); // 削除後の再配置
    },
  },
  watch: {
    layoutDirection: {
      immediate: true,
      handler(newDirection) {
        console.log(`レイアウト方向が${newDirection}に変更されました`);
        this.arrangeNodes(this.nodes); // ノードの再配置をトリガー
      },
    },
  },
};
</script>
