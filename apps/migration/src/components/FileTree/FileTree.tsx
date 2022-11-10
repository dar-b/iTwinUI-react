/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { NodeData, Tree, TreeNode } from '@itwin/itwinui-react';
// import SvgAdd from '@itwin/itwinui-icons-react/cjs/icons/Add';

import React from 'react';

export const FileTree = () => {
  type StoryData = {
    id: string;
    label: string;
    sublabel: string;
    subItems: StoryData[];
  };

  const [expandedNodes, setExpandedNodes] = React.useState<
    Record<string, boolean>
  >({
    'Node-2': true,
    'Node-2-1': true,
    'Node-3': true,
  });
  const onNodeExpanded = React.useCallback(
    (nodeId: string, isExpanded: boolean) => {
      if (isExpanded) {
        setExpandedNodes((oldExpanded) => ({ ...oldExpanded, [nodeId]: true }));
        console.log(`Expanded node ${nodeId}`);
      } else {
        setExpandedNodes((oldExpanded) => ({
          ...oldExpanded,
          [nodeId]: false,
        }));
        console.log(`Closed node ${nodeId}`);
      }
    },
    [],
  );
  const generateItem = React.useCallback(
    (index: number, parentNode = '', depth = 0): StoryData => {
      const keyValue = parentNode ? `${parentNode}-${index}` : `${index}`;
      return {
        id: `Node-${keyValue}`,
        label: `Node ${keyValue}`,
        sublabel: `Sublabel for Node ${keyValue}`,
        subItems:
          depth < 10
            ? Array(Math.round(index % 5))
                .fill(null)
                .map((_, index) => generateItem(index, keyValue, depth + 1))
            : [],
      };
    },
    [],
  );

  const data = React.useMemo(
    () =>
      Array(50)
        .fill(null)
        .map((_, index) => generateItem(index)),
    [generateItem],
  );

  const getNode = React.useCallback(
    (node: StoryData): NodeData<StoryData> => {
      return {
        subNodes: node.subItems,
        nodeId: node.id,
        node: node,
        isExpanded: expandedNodes[node.id],
        hasSubNodes: node.subItems.length > 0,
      };
    },
    [expandedNodes],
  );

  return (
    <span>
      <Tree<StoryData>
        data={data}
        getNode={getNode}
        nodeRenderer={React.useCallback(
          ({ node, ...rest }) => (
            <TreeNode
              label={node.label}
              sublabel={node.sublabel}
              onExpanded={onNodeExpanded}
              // icon={<SvgAdd />}
              {...rest}
            />
          ),
          [onNodeExpanded],
        )}
      />
    </span>
  );
};
