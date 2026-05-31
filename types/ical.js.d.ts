declare module "ical.js" {
  function parse(input: string): unknown;

  class Component {
    constructor(jCal: unknown, parent?: Component);
    getAllSubcomponents(name: string): Component[];
    getFirstPropertyValue(name: string): string | null;
    getFirstProperty(name: string): Property | undefined;
  }

  class Property {
    getFirstValue(): unknown;
    name: string;
  }

  class Event {
    constructor(component: Component, options?: { strictExceptions?: boolean });
    uid:         string;
    summary:     string;
    description: string;
    location:    string;
    color:       string;
    startDate:   Time;
    endDate:     Time;
    isRecurring(): boolean;
    isRecurrenceException(): boolean;
    iterator(startTime?: Time): RecurExpansion;
    getOccurrenceDetails(time: Time): OccurrenceDetails;
  }

  interface OccurrenceDetails {
    recurrenceId: Time;
    startDate:    Time;
    endDate:      Time | undefined;  // absent when event uses DURATION instead of DTEND
    item:         Event;
  }

  class Time {
    isDate: boolean;
    year:   number;
    month:  number;
    day:    number;
    hour:   number;
    minute: number;

    clone(): Time;
    compare(other: Time): number;
    toJSDate(): Date;
    toUnixTime(): number;
    addDuration(duration: Duration): void;

    static now(): Time;
    static fromJSDate(date: Date, useUTC?: boolean): Time;
  }

  class Duration {
    constructor(data?: {
      weeks?:   number;
      days?:    number;
      hours?:   number;
      minutes?: number;
      seconds?: number;
    });
  }

  class RecurExpansion {
    complete: boolean;
    /** Returns the next occurrence, or null/undefined when exhausted. */
    next(): Time | null | undefined;
  }
}
