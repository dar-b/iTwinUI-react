/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from 'react';
import { Input, InputProps } from '../Input';
import { useSafeContext, useMergedRefs } from '../utils';
import {
  ComboBoxStateContext,
  ComboBoxActionContext,
  ComboBoxRefsContext,
} from './helpers';

type ComboBoxInputProps = InputProps;

export const ComboBoxInput = React.forwardRef(
  (props: ComboBoxInputProps, forwardedRef: React.Ref<HTMLInputElement>) => {
    const { onKeyDown: onKeyDownProp, onFocus: onFocusProp, ...rest } = props;

    const {
      isOpen,
      id,
      focusedIndex,
      enableVirtualization,
      multiple,
      onChangeHandler,
    } = useSafeContext(ComboBoxStateContext);
    const dispatch = useSafeContext(ComboBoxActionContext);
    const { inputRef, menuRef, optionsExtraInfoRef } = useSafeContext(
      ComboBoxRefsContext,
    );
    const refs = useMergedRefs(inputRef, forwardedRef);

    const focusedIndexRef = React.useRef(focusedIndex ?? -1);
    React.useEffect(() => {
      focusedIndexRef.current = focusedIndex ?? -1;
    }, [focusedIndex]);

    const getIdFromIndex = (index: number) => {
      return (
        menuRef.current?.querySelector(`[data-iui-index="${index}"]`)?.id ?? ''
      );
    };

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        onKeyDownProp?.(event);
        const length = Object.keys(optionsExtraInfoRef.current).length ?? 0;

        switch (event.key) {
          case 'ArrowDown': {
            event.preventDefault();
            if (!isOpen) {
              return dispatch({ type: 'open' });
            }

            if (length === 0) {
              return;
            }

            if (focusedIndexRef.current === -1) {
              const currentElement = menuRef.current?.querySelector(
                '[data-iui-index]',
              );
              return dispatch({
                type: 'focus',
                value: Number(
                  currentElement?.getAttribute('data-iui-index') ?? 0,
                ),
              });
            }

            // If virtualization is enabled, dont let round scrolling
            if (
              enableVirtualization &&
              !menuRef.current?.querySelector(
                `[data-iui-index="${focusedIndexRef.current}"]`,
              )?.nextElementSibling
            ) {
              return;
            }

            let nextIndex = focusedIndexRef.current;
            do {
              const currentElement = menuRef.current?.querySelector(
                `[data-iui-index="${nextIndex}"]`,
              );
              const nextElement =
                currentElement?.nextElementSibling ??
                menuRef.current?.querySelector('[data-iui-index]');
              nextIndex = Number(nextElement?.getAttribute('data-iui-index'));

              if (nextElement?.ariaDisabled !== 'true') {
                return dispatch({ type: 'focus', value: nextIndex });
              }
            } while (nextIndex !== focusedIndexRef.current);
            break;
          }
          case 'ArrowUp': {
            event.preventDefault();
            if (!isOpen) {
              return dispatch({ type: 'open' });
            }

            if (length === 0) {
              return;
            }

            // If virtualization is enabled, dont let round scrolling
            if (
              enableVirtualization &&
              !menuRef.current?.querySelector(
                `[data-iui-index="${focusedIndexRef.current}"]`,
              )?.previousElementSibling
            ) {
              return;
            }

            if (focusedIndexRef.current === -1) {
              return dispatch({
                type: 'focus',
                value:
                  Object.values(optionsExtraInfoRef.current)?.[length - 1]
                    .__originalIndex ?? -1,
              });
            }

            let prevIndex = focusedIndexRef.current;
            do {
              const currentElement = menuRef.current?.querySelector(
                `[data-iui-index="${prevIndex}"]`,
              );
              const prevElement =
                currentElement?.previousElementSibling ??
                menuRef.current?.querySelector('[data-iui-index]:last-of-type');
              prevIndex = Number(prevElement?.getAttribute('data-iui-index'));

              if (prevElement?.ariaDisabled !== 'true') {
                return dispatch({ type: 'focus', value: prevIndex });
              }
            } while (prevIndex !== focusedIndexRef.current);
            break;
          }
          case 'Enter': {
            event.preventDefault();
            if (isOpen) {
              if (multiple) {
                if (focusedIndexRef.current > -1) {
                  dispatch({
                    type: 'multiselect',
                    value: focusedIndexRef.current,
                  });
                  onChangeHandler?.(focusedIndexRef.current);
                } else {
                  dispatch({ type: 'close' });
                }
              } else {
                dispatch({ type: 'select', value: focusedIndexRef.current });
                onChangeHandler?.(focusedIndexRef.current);
                dispatch({ type: 'close' });
              }
            } else {
              dispatch({ type: 'open' });
            }
            break;
          }
          case 'Escape': {
            event.preventDefault();
            dispatch({ type: 'close' });
            break;
          }
          case 'Tab':
            dispatch({ type: 'close' });
            break;
        }
      },
      [
        dispatch,
        enableVirtualization,
        isOpen,
        menuRef,
        multiple,
        onChangeHandler,
        onKeyDownProp,
        optionsExtraInfoRef,
      ],
    );

    const handleFocus = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        dispatch({ type: 'open' });
        onFocusProp?.(event);
      },
      [dispatch, onFocusProp],
    );

    return (
      <Input
        ref={refs}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        aria-activedescendant={
          isOpen && focusedIndex != undefined && focusedIndex > -1
            ? getIdFromIndex(focusedIndex)
            : undefined
        }
        role='combobox'
        aria-controls={isOpen ? `${id}-list` : undefined}
        aria-autocomplete='list'
        spellCheck={false}
        autoCapitalize='none'
        autoCorrect='off'
        {...rest}
      />
    );
  },
);
ComboBoxInput.displayName = 'ComboBoxInput';
