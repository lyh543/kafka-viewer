import type { TreeDataNode } from 'antd';

export interface DataTreeNode extends TreeDataNode {
  key: string;
  children?: DataTreeNode[];
}
