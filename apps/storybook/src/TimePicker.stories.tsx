/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { action } from '@storybook/addon-actions';
import { Meta, Story } from '@storybook/react';
import React from 'react';
import {
  TimePicker,
  TimePickerProps,
  IconButton,
  LabeledInput,
} from '@itwin/itwinui-react';
import SvgCalendar from '@itwin/itwinui-icons-react/cjs/icons/Calendar';

export default {
  title: 'Core/TimePicker',
  component: TimePicker,
  argTypes: {
    onChange: { control: { disable: true } },
    className: { control: { disable: true } },
    style: { control: { disable: true } },
    id: { control: { disable: true } },
    date: { control: { type: 'date' } },
  },
  args: { use12Hours: false },
} as Meta<TimePickerProps>;

export const Basic: Story<TimePickerProps> = (args) => {
  const {
    date = new Date(2021, 4, 11, 14, 55, 22),
    setFocusHour = true,
    use12Hours = false,
    ...rest
  } = args;
  const [opened, setOpened] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState(new Date(date));
  const onChange = (date: Date) => {
    setCurrentDate(date);
    action(`New Time value: ${date}`, { clearOnStoryChange: false })();
  };

  React.useEffect(() => {
    setCurrentDate(new Date(date));
    return () => action('', { clearOnStoryChange: true })();
  }, [date]);
  return (
    <>
      <LabeledInput
        displayStyle='inline'
        value={currentDate.toLocaleTimeString('en-US', { timeStyle: 'short' })}
        svgIcon={
          <IconButton
            styleType='borderless'
            onClick={() => setOpened((v) => !v)}
          >
            <SvgCalendar />
          </IconButton>
        }
        style={{ width: 150 }}
        readOnly
        id='time-input'
      />
      {opened && (
        <div>
          <TimePicker
            {...rest}
            date={currentDate}
            onChange={onChange}
            setFocusHour={setFocusHour}
            use12Hours={use12Hours}
          />
        </div>
      )}
    </>
  );
};

Basic.args = {
  date: new Date(2021, 4, 11, 14, 55, 22),
  setFocusHour: true,
};

export const Combined: Story<TimePickerProps> = (args) => {
  const {
    date = new Date(2021, 4, 11, 14, 55, 30),
    setFocusHour = true,
    precision = 'seconds',
    hourStep = 1,
    minuteStep = 1,
    secondStep = 15,
    use12Hours = true,
    useCombinedRenderer = true,
    ...rest
  } = args;
  const [opened, setOpened] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState(new Date(date));
  const onChange = (date: Date) => {
    setCurrentDate(date);
    action(`New Time value: ${date}`, { clearOnStoryChange: false })();
  };

  const inputValueType = precision === 'seconds' ? 'medium' : 'short';

  React.useEffect(() => {
    setCurrentDate(new Date(date));
    return () => action('', { clearOnStoryChange: true })();
  }, [date]);
  return (
    <>
      <LabeledInput
        displayStyle='inline'
        value={currentDate.toLocaleTimeString('en-US', {
          timeStyle: inputValueType,
        })}
        svgIcon={
          <IconButton
            styleType='borderless'
            onClick={() => setOpened((v) => !v)}
          >
            <SvgCalendar />
          </IconButton>
        }
        style={{ width: 150 }}
        readOnly
        id='time-input'
      />
      {opened && (
        <div>
          <TimePicker
            {...rest}
            date={currentDate}
            onChange={onChange}
            setFocusHour={setFocusHour}
            useCombinedRenderer={useCombinedRenderer}
            precision={precision}
            hourStep={hourStep}
            minuteStep={minuteStep}
            secondStep={secondStep}
            use12Hours={use12Hours}
          />
        </div>
      )}
    </>
  );
};

Combined.args = {
  date: new Date(2021, 4, 11, 14, 55, 30),
  setFocusHour: true,
  precision: 'seconds',
  hourStep: 1,
  minuteStep: 1,
  secondStep: 15,
  use12Hours: true,
  useCombinedRenderer: true,
};
