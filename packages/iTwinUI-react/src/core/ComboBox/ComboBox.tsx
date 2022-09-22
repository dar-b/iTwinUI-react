/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from 'react';
import cx from 'classnames';
import { InputProps } from '../Input';
import { MenuExtraContent } from '../Menu';
import { SelectOption, SelectValueChangeEvent } from '../Select';
import { Text } from '../Typography';
import {
  useTheme,
  PopoverProps,
  CommonProps,
  getRandomValue,
  InputContainerProps,
  mergeRefs,
  useLatestRef,
  useContainerWidth,
} from '../utils';
import 'tippy.js/animations/shift-away.css';
import {
  ComboBoxActionContext,
  comboBoxReducer,
  ComboBoxRefsContext,
  ComboBoxStateContext,
} from './helpers';
import { ComboBoxDropdown } from './ComboBoxDropdown';
import { ComboBoxEndIcon } from './ComboBoxEndIcon';
import { ComboBoxInput } from './ComboBoxInput';
import { ComboBoxInputContainer } from './ComboBoxInputContainer';
import { ComboBoxMenu } from './ComboBoxMenu';
import { ComboBoxMenuItem } from './ComboBoxMenuItem';
import SelectTag from '../Select/SelectTag';
import { ComboBoxMultipleContainer } from './ComboBoxMultipleContainer';

const isMultipleEnabled = <T,>(
  variable: (T | undefined) | (T[] | undefined),
  multiple: boolean,
): variable is T[] | undefined => {
  return multiple;
};

// Type guard for multiple did not work
const isSingleOnChange = <T,>(
  onChange:
    | (((value: T) => void) | undefined)
    | (((value: T, event: SelectValueChangeEvent) => void) | undefined),
  multiple: boolean,
): onChange is ((value: T) => void) | undefined => {
  return !multiple;
};

type ComboboxMultipleTypeProps<T> = {
  /**
   * Enable multiple selection.
   * @default false
   */
  multiple?: boolean;
  /**
   * Controlled value of ComboBox.
   * If `multiple` is enabled, it is an array of values.
   */
  value?: T | T[];
  /**
   * Callback fired when selected value changes.
   */
  onChange?:
    | ((value: T) => void)
    | ((value: T, event: SelectValueChangeEvent) => void);
};

export type ComboBoxProps<T> = {
  /**
   * Array of options that populate the dropdown list.
   */
  options: SelectOption<T>[];
  /**
   * Message shown below the combobox.
   * Use `StatusMessage` component.
   */
  message?: React.ReactNode;
  /**
   * Function to customize the default filtering logic.
   */
  filterFunction?: (
    options: SelectOption<T>[],
    inputValue: string,
  ) => SelectOption<T>[];
  /**
   * Native input element props.
   */
  inputProps?: Omit<InputProps, 'setFocus'>;
  /**
   * Props to customize dropdown menu behavior.
   */
  dropdownMenuProps?: PopoverProps;
  /**
   * Message shown when no options are available.
   * If `JSX.Element` is provided, it will be rendered as is and won't be wrapped with `MenuExtraContent`.
   * @default 'No options found'
   */
  emptyStateMessage?: React.ReactNode;
  /**
   * A custom item renderer can be specified to control the rendering.
   *
   * For keyboard navigation to work, the returned element should use the `id` provided by this function.
   * The `isFocused` state is calculated using this `id` and can be used for specifying the focus styling.
   * If a `MenuItem` is returned, then focus styling is automatically handled.
   */
  itemRenderer?: (
    option: SelectOption<T>,
    states: {
      isSelected: boolean;
      isFocused: boolean;
      id: string;
      index: number;
    },
  ) => JSX.Element;
  /**
   * If enabled, virtualization is used for the scrollable dropdown list.
   * Use it if you expect a very long list of items.
   * @default false
   * @beta
   */
  enableVirtualization?: boolean;
  /**
   * Callback fired when dropdown menu is opened.
   */
  onShow?: () => void;
  /**
   * Callback fired when dropdown menu is closed.
   */
  onHide?: () => void;
} & ComboboxMultipleTypeProps<T> &
  Pick<InputContainerProps, 'status'> &
  Omit<CommonProps, 'title'>;

/** Returns either `option.id` or derives a stable id using `idPrefix` and `option.label` (without whitespace) */
const getOptionId = (option: SelectOption<unknown>, idPrefix: string) => {
  return option.id ?? `${idPrefix}-option-${option.label.replace(/\s/g, '-')}`;
};

/**
 * ComboBox component that allows typing a value to filter the options in dropdown list.
 * Values can be selected either using mouse clicks or using the Enter key.
 * @example
 * <ComboBox
 *   options={[
 *     { label: 'Item 1', value: 1 },
 *     { label: 'Item 2', value: 2 },
 *     { label: 'Item 3', value: 3 },
 *   ]}
 *   onChange={() => {}}
 * />
 */
export const ComboBox = <T,>(props: ComboBoxProps<T>) => {
  const {
    options,
    value: valueProp,
    onChange,
    filterFunction,
    inputProps,
    dropdownMenuProps,
    emptyStateMessage = 'No options found',
    itemRenderer,
    enableVirtualization = false,
    multiple = false,
    onShow,
    onHide,
    ...rest
  } = props;

  // Generate a stateful random id if not specified
  const [id] = React.useState(
    () =>
      props.id ??
      (inputProps?.id && `${inputProps.id}-cb`) ??
      `iui-cb-${getRandomValue(10)}`,
  );

  useTheme();

  // Refs get set in subcomponents
  const inputRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLUListElement>(null);
  const toggleButtonRef = React.useRef<HTMLSpanElement>(null);
  const mounted = React.useRef(false);

  const valuePropRef = useLatestRef(valueProp);
  const onChangeProp = useLatestRef(onChange);
  const optionsRef = useLatestRef(options);

  // Record to store all extra information (e.g. original indexes), where the key is the id of the option
  const optionsExtraInfoRef = React.useRef<
    Record<string, { __originalIndex: number }>
  >({});

  // Clear the extra info when the options change so that it can be reinitialized below
  React.useEffect(() => {
    optionsExtraInfoRef.current = {};
  }, [options]);

  // Initialize the extra info only if it is not already initialized
  if (
    options.length > 0 &&
    Object.keys(optionsExtraInfoRef.current).length === 0
  ) {
    options.forEach((option, index) => {
      optionsExtraInfoRef.current[getOptionId(option, id)] = {
        __originalIndex: index,
      };
    });
  }

  // Get indices of selected elements in options array when we have selected values.
  const getSelectedIndexes = () => {
    const indexArray: number[] = [];
    if (isMultipleEnabled(valueProp, multiple)) {
      valueProp?.forEach((value) => {
        indexArray.push(
          optionsRef.current.findIndex((option) => option.value === value),
        );
      });
    }
    return indexArray;
  };

  // Reducer where all the component-wide state is stored
  const [{ isOpen, selectedIndex, focusedIndex }, dispatch] = React.useReducer(
    comboBoxReducer,
    {
      isOpen: false,
      selectedIndex: isMultipleEnabled(valueProp, multiple)
        ? getSelectedIndexes()
        : optionsRef.current.findIndex((option) => option.value === valueProp),
      focusedIndex: -1,
    },
  );

  const selectedOptions = React.useMemo(() => {
    if (selectedIndex == null) {
      return undefined;
    }
    const item = isMultipleEnabled(selectedIndex, multiple)
      ? selectedIndex.map((index) => optionsRef.current[index])
      : optionsRef.current[selectedIndex];
    return item;
  }, [multiple, optionsRef, selectedIndex]);

  React.useLayoutEffect(() => {
    // When the dropdown opens
    if (isOpen) {
      inputRef.current?.focus(); // Focus the input
      setFilteredOptions(optionsRef.current); // Reset the filtered list
      dispatch(['focus']);
    }
    // When the dropdown closes
    else {
      // Reset the focused index
      dispatch(['focus']);
      // Reset the input value
      if (!isMultipleEnabled(selectedIndex, multiple)) {
        setInputValue(
          selectedIndex != undefined && selectedIndex >= 0
            ? optionsRef.current[selectedIndex]?.label
            : '',
        );
      }
    }
  }, [isOpen, multiple, optionsRef, selectedIndex]);

  // Set min-width of menu to be same as input
  const [minWidth, setMinWidth] = React.useState(0);
  React.useEffect(() => {
    if (inputRef.current) {
      setMinWidth(inputRef.current.offsetWidth);
    }
  }, [isOpen]);

  // Update filtered options to the latest value options according to input value
  const [filteredOptions, setFilteredOptions] = React.useState(options);
  React.useEffect(() => {
    if (inputValue) {
      setFilteredOptions(
        filterFunction?.(options, inputValue) ??
          options.filter((option) =>
            option.label.toLowerCase().includes(inputValue.toLowerCase()),
          ),
      );
    } else {
      setFilteredOptions(options);
    }
    dispatch(['focus']);
    // Only need to call on options update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  // Filter options based on input value
  const [inputValue, setInputValue] = React.useState<string>(
    inputProps?.value?.toString() ?? '',
  );
  const handleOnInput = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;
      setInputValue(value);
      dispatch(['open']); // reopen when typing
      setFilteredOptions(
        filterFunction?.(optionsRef.current, value) ??
          optionsRef.current.filter((option) =>
            option.label.toLowerCase().includes(value.toLowerCase()),
          ),
      );
      if (focusedIndex != -1) {
        dispatch(['focus', -1]);
      }
      inputProps?.onChange?.(event);
    },
    [filterFunction, focusedIndex, inputProps, optionsRef],
  );

  // When the value prop changes, update the selectedIndex
  // TODO add multiselect version of this
  // add reducer
  React.useEffect(() => {
    if (isMultipleEnabled(valueProp, multiple)) {
      // valueProp?.map((item) => {
      //   dispatch([
      //     'multiselect',
      //     options.findIndex((option) => option.value === item),
      //   ]);
      // });
    } else {
      dispatch([
        'select',
        options.findIndex((option) => option.value === valueProp),
      ]);
    }
  }, [multiple, options, valueProp]);

  // Call user-defined onChange when the value actually changes
  // move onClick ????
  React.useEffect(() => {
    // Prevent user-defined onChange to be called on mount
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (isMultipleEnabled(selectedIndex, multiple)) {
      const currentOptions = selectedOptions as SelectOption<T>[];
      if (
        !isSingleOnChange(onChangeProp.current, multiple) &&
        currentOptions.length > 0
      ) {
        currentOptions.map((option) =>
          onChangeProp.current?.(
            option.value,
            option.isSelected ? 'removed' : 'added',
          ),
        );
      }
    } else {
      const currentValue = optionsRef.current[selectedIndex]?.value;

      if (currentValue === valuePropRef.current || selectedIndex === -1) {
        return;
      }

      if (isSingleOnChange(onChangeProp.current, multiple)) {
        onChangeProp.current?.(currentValue);
      }
    }
  }, [
    multiple,
    onChangeProp,
    optionsRef,
    selectedIndex,
    selectedOptions,
    valuePropRef,
  ]);

  const isMenuItemSelected = React.useCallback(
    (index: number) => {
      if (isMultipleEnabled(selectedIndex, multiple)) {
        return !!selectedIndex.includes(index as number);
      } else {
        return selectedIndex === index;
      }
    },
    [multiple, selectedIndex],
  );

  const onClickHandler = React.useCallback(
    (__originalIndex: number) => {
      if (isMultipleEnabled(selectedIndex, multiple)) {
        dispatch(['multiselect', __originalIndex]);
        setInputValue('');
      } else {
        dispatch(['select', __originalIndex]);
        dispatch(['close']);
      }
    },
    [multiple, selectedIndex],
  );

  const getMenuItem = React.useCallback(
    (option: SelectOption<T>, filteredIndex?: number) => {
      const optionId = getOptionId(option, id);
      const { __originalIndex } = optionsExtraInfoRef.current[optionId];

      const customItem = itemRenderer
        ? itemRenderer(option, {
            isFocused: focusedIndex === __originalIndex,
            isSelected: selectedIndex === __originalIndex,
            index: __originalIndex,
            id: optionId,
          })
        : null;

      return customItem ? (
        React.cloneElement(customItem, {
          onClick: (e: unknown) => {
            onClickHandler(__originalIndex);
            customItem.props.onClick?.(e);
          },
          // ComboBox.MenuItem handles scrollIntoView, data-iui-index and iui-focused through context
          // but we still need to pass them here for backwards compatibility with MenuItem
          className: cx(customItem.props.className, {
            'iui-focused': focusedIndex === __originalIndex,
          }),
          'data-iui-index': __originalIndex,
          'data-iui-filtered-index': filteredIndex,
          ref: mergeRefs(customItem.props.ref, (el: HTMLLIElement | null) => {
            if (!enableVirtualization && focusedIndex === __originalIndex) {
              el?.scrollIntoView({ block: 'nearest' });
            }
          }),
        })
      ) : (
        <ComboBoxMenuItem
          key={optionId}
          id={optionId}
          {...option}
          isSelected={isMenuItemSelected(__originalIndex)}
          onClick={() => {
            onClickHandler(__originalIndex);
          }}
          index={__originalIndex}
          data-iui-filtered-index={filteredIndex}
        >
          {option.label}
        </ComboBoxMenuItem>
      );
    },
    [
      enableVirtualization,
      focusedIndex,
      id,
      isMenuItemSelected,
      itemRenderer,
      onClickHandler,
      selectedIndex,
    ],
  );

  const emptyContent = React.useMemo(
    () => (
      <>
        {React.isValidElement(emptyStateMessage) ? (
          emptyStateMessage
        ) : (
          <MenuExtraContent>
            <Text isMuted>{emptyStateMessage}</Text>
          </MenuExtraContent>
        )}
      </>
    ),
    [emptyStateMessage],
  );

  const [tagContainerWidthRef, tagContainerWidth] = useContainerWidth(true);
  // const [tagContainerHeightRef, tagContainerHeight] = useContainerHeight(true);

  const tagRenderer = React.useCallback((item: SelectOption<T>) => {
    return <SelectTag key={item.label} label={item.label} />;
  }, []);

  return (
    <ComboBoxRefsContext.Provider
      value={{ inputRef, menuRef, toggleButtonRef, optionsExtraInfoRef }}
    >
      <ComboBoxActionContext.Provider value={dispatch}>
        <ComboBoxStateContext.Provider
          value={{
            id,
            minWidth,
            isOpen,
            focusedIndex: focusedIndex,
            enableVirtualization,
            filteredOptions,
            getMenuItem,
            multiple,
          }}
        >
          <ComboBoxInputContainer disabled={inputProps?.disabled} {...rest}>
            <>
              <ComboBoxInput
                style={
                  isMultipleEnabled(selectedIndex, multiple)
                    ? {
                        paddingLeft: tagContainerWidth + 18,
                      }
                    : {}
                }
                value={inputValue}
                {...inputProps}
                onChange={handleOnInput}
              />
              {isMultipleEnabled(selectedIndex, multiple) && (
                <ComboBoxMultipleContainer
                  mRef={tagContainerWidthRef}
                  selectedItems={selectedOptions as SelectOption<T>[]}
                  tagRenderer={tagRenderer}
                />
              )}
            </>
            <ComboBoxEndIcon disabled={inputProps?.disabled} isOpen={isOpen} />
          </ComboBoxInputContainer>
          <ComboBoxDropdown
            {...dropdownMenuProps}
            onShow={onShow}
            onHide={onHide}
          >
            <ComboBoxMenu>
              {filteredOptions.length > 0 && !enableVirtualization
                ? filteredOptions.map(getMenuItem)
                : emptyContent}
            </ComboBoxMenu>
          </ComboBoxDropdown>
        </ComboBoxStateContext.Provider>
      </ComboBoxActionContext.Provider>
    </ComboBoxRefsContext.Provider>
  );
};

export default ComboBox;
