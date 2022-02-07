/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from 'react';
import { useResizeObserver } from '../hooks/useResizeObserver';

const getScrollableParent = (
  element: HTMLElement | null,
  ownerDocument: Document = document,
): HTMLElement => {
  if (!element || element === ownerDocument.body) {
    return ownerDocument.body;
  }

  return isElementScrollable(element)
    ? element
    : getScrollableParent(element.parentElement, ownerDocument);
};

const isElementScrollable = (element: HTMLElement) => {
  return /(auto|scroll|overlay)/.test(
    getElementStyle(element, 'overflow') +
      getElementStyle(element, 'overflow-y'),
  );
};

const getElementStyle = (element: HTMLElement, prop: string) => {
  return getComputedStyle(element, null).getPropertyValue(prop);
};

const getElementHeight = (element: HTMLElement | undefined) => {
  return element?.getBoundingClientRect().height ?? 0;
};

const getElementHeightWithMargins = (element: HTMLElement | undefined) => {
  if (!element) {
    return 0;
  }

  const margin =
    parseFloat(getElementStyle(element, 'margin-top')) +
    parseFloat(getElementStyle(element, 'margin-bottom'));
  return getElementHeight(element) + margin;
};

const getNumberOfNodesInHeight = (childHeight: number, totalHeight: number) => {
  if (!childHeight) {
    return 0;
  }

  return Math.floor(totalHeight / childHeight);
};

const getTranslateValue = (
  childHeight: number,
  firstChildHeight: number,
  startIndex: number,
) => {
  if (startIndex > 0) {
    return childHeight * (startIndex - 1) + firstChildHeight;
  }

  return 0;
};

const getVisibleNodeCount = (
  childHeight: number,
  startIndex: number,
  childrenLength: number,
  scrollContainer: HTMLElement,
) => {
  return Math.min(
    childrenLength - startIndex,
    getNumberOfNodesInHeight(childHeight, getElementHeight(scrollContainer)),
  );
};

export type VirtualScrollProps = {
  /**
   * Length of the items to virtualize.
   */
  itemsLength: number;
  /**
   * Single item render function, which gives index of the item (0 based) in the data array
   * and expects to get the JSX of that element to render.
   * Recommended to memoize the reference of the function.
   */
  itemRenderer: (index: number) => JSX.Element;
  /**
   * Number of items to be rendered at the start and the end.
   * Not recommended to go lower than the visible items in viewport.
   * @default 10
   */
  bufferSize?: number;
  /**
   * Index of the first element on initial render.
   * @default 0
   */
  scrollToIndex?: number;
} & React.ComponentPropsWithRef<'div'>;

/**
 * `VirtualScroll` component is used to render a huge amount of items in the DOM. It renders only the ones which are visible
 * and the amount provided through `bufferSize` prop at the start and the end. Can be used inside other components like `Table`.
 *
 * It has two wrapper elements, so DOM will be changed. One is used for setting full expected height in the scrollable container
 * and other is for transformation (translateY) to show the correct part of the list.
 *
 * Currently it works only with the direct vertically scrollable parent element. It does not work with body scroll.
 * It supports only static (same) height rows virtualization. Expect some issues, if list consists of different height elements.
 * @example
 * const itemRenderer = React.useCallback(() => (
 *  <div key={index}>
 *    This is my item #{index}
 *  </div>
 * ), [])
 * <VirtualScroll
 *  itemsLength={1000}
 *  itemRenderer={itemRenderer}
 * />
 * @private
 */
export const VirtualScroll = React.forwardRef<
  HTMLDivElement,
  VirtualScrollProps
>(
  (
    {
      itemsLength,
      itemRenderer,
      bufferSize = 10,
      scrollToIndex = 0,
      style,
      ...rest
    },
    ref,
  ) => {
    const [startNode, setStartNode] = React.useState(0);
    const [visibleNodeCount, setVisibleNodeCount] = React.useState(0);
    const scrollContainer = React.useRef<HTMLElement>();
    const parentRef = React.useRef<HTMLDivElement>(null);
    const childHeight = React.useRef({ firstChild: 0, child: 0, lastChild: 0 });
    const onScrollRef = React.useRef<(e: Event) => void>();
    // Used only to recalculate on resize
    const [scrollContainerHeight, setScrollContainerHeight] = React.useState(0);

    const onResize = React.useCallback(({ height }) => {
      setScrollContainerHeight(height);
    }, []);
    const [resizeRef] = useResizeObserver(onResize);

    // Find scrollable parent
    // Needed only on init
    React.useLayoutEffect(() => {
      const scrollableParent = getScrollableParent(
        parentRef.current,
        parentRef.current?.ownerDocument,
      );
      scrollContainer.current = scrollableParent;

      resizeRef(scrollableParent);
    }, [resizeRef]);

    const visibleChildren = React.useMemo(() => {
      const arr = [];
      const endIndex = Math.min(
        itemsLength,
        startNode + visibleNodeCount + bufferSize * 2,
      );
      for (let i = startNode; i < endIndex; i++) {
        arr.push(itemRenderer(i));
      }
      return arr;
    }, [itemsLength, itemRenderer, bufferSize, startNode, visibleNodeCount]);

    // Get child height when children available
    React.useLayoutEffect(() => {
      if (!parentRef.current || !visibleChildren.length) {
        return;
      }

      const firstChild = parentRef.current.children.item(0) as HTMLElement;
      const child = parentRef.current.children.item(1) as HTMLElement;
      const lastChild = parentRef.current.children.item(
        parentRef.current.children.length - 1,
      ) as HTMLElement;
      const firstChildHeight = Number(
        getElementHeightWithMargins(firstChild).toFixed(2),
      );

      childHeight.current = {
        firstChild: firstChildHeight,
        child:
          Number(getElementHeightWithMargins(child).toFixed(2)) ??
          firstChildHeight,
        lastChild: Number(getElementHeightWithMargins(lastChild).toFixed(2)),
      };
    }, [visibleChildren.length]);

    const updateVirtualScroll = React.useCallback(
      (scrollTop?: number) => {
        const scrollableContainer =
          scrollContainer.current ??
          (parentRef.current?.ownerDocument.scrollingElement as HTMLElement);
        if (!scrollableContainer) {
          return;
        }
        const start = getNumberOfNodesInHeight(
          childHeight.current.child,
          scrollTop ?? scrollableContainer.scrollTop,
        );
        const startIndex = Math.max(0, start - bufferSize);
        setStartNode(startIndex);
        setVisibleNodeCount(
          getVisibleNodeCount(
            childHeight.current.child,
            start,
            itemsLength,
            scrollableContainer,
          ),
        );

        if (!parentRef.current) {
          return;
        }
        parentRef.current.style.transform = `translateY(${getTranslateValue(
          childHeight.current.child,
          childHeight.current.firstChild,
          startIndex,
        )}px)`;

        scrollTop && scrollContainer.current?.scrollTo({ top: scrollTop });
      },
      [bufferSize, itemsLength],
    );

    const onScroll = React.useCallback(() => {
      updateVirtualScroll();
    }, [updateVirtualScroll]);

    const removeScrollListener = React.useCallback(() => {
      if (!onScrollRef.current) {
        return;
      }
      !scrollContainer.current ||
      scrollContainer.current === parentRef.current?.ownerDocument.body
        ? parentRef.current?.ownerDocument.removeEventListener(
            'scroll',
            onScrollRef.current,
          )
        : scrollContainer.current.removeEventListener(
            'scroll',
            onScrollRef.current,
          );
    }, []);

    // Add event listener to the scrollable container.
    React.useLayoutEffect(() => {
      removeScrollListener();
      onScrollRef.current = onScroll;
      if (
        !scrollContainer.current ||
        scrollContainer.current === parentRef.current?.ownerDocument.body
      ) {
        parentRef.current?.ownerDocument.addEventListener('scroll', onScroll);
      } else {
        scrollContainer.current.addEventListener('scroll', onScroll);
      }
      return removeScrollListener;
    }, [onScroll, removeScrollListener]);

    React.useLayoutEffect(() => {
      if (!scrollContainerHeight) {
        return;
      }

      updateVirtualScroll(
        scrollToIndex > 0
          ? (scrollToIndex - 1) * childHeight.current.child +
              childHeight.current.firstChild
          : undefined,
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollContainerHeight]);

    return (
      <div
        style={{
          overflow: 'hidden',
          minHeight:
            Math.max(itemsLength - 2, 0) * childHeight.current.child +
            childHeight.current.firstChild +
            childHeight.current.lastChild,
          width: '100%',
          ...style,
        }}
        ref={ref}
        {...rest}
      >
        <div
          style={{
            willChange: 'transform',
          }}
          ref={parentRef}
        >
          {visibleChildren}
        </div>
      </div>
    );
  },
);

export default VirtualScroll;
