import { EMPTY_ARRAY } from '../../utilities/data/array'
import { localDateToUtcDate, utcDateToLocalDate } from '../../utilities/data/dateTime'
import { ProjectExecution } from '../Backend'

/** Options for {@link getProjectExecutionRepetitionsForDateRange}. */
export interface GetProjectExecutionRepetitionsForDateRangeOptions {
  /** Defaults to `false`. */
  readonly includeHourlyRepeats?: boolean
}

/** The first execution date of the given {@link ProjectExecution} on or after the given date. */
export function firstProjectExecutionOnOrAfter(
  projectExecution: ProjectExecution,
  startDate: Date,
): Date {
  const nextDate = localDateToUtcDate(startDate)
  const {
    repeatInterval,
    time: { minute, hours = [], dates = [], days = [] },
  } = projectExecution
  nextDate.setMinutes(minute)
  switch (repeatInterval) {
    case 'hourly': {
      if (nextDate < startDate) {
        nextDate.setHours(nextDate.getHours() + 1)
      }
      break
    }
    case 'daily':
    case 'weekly':
    case 'monthly': {
      const currentHours = nextDate.getHours()
      const hour = hours.find(hour => hour >= currentHours) ?? hours[0] ?? 0
      nextDate.setHours(hour)
      switch (repeatInterval) {
        case 'daily': {
          break
        }
        case 'weekly': {
          const currentDay = nextDate.getDay()
          const day = days.find(day => day >= currentDay) ?? days[0] ?? 0
          const dayOffset = (day - currentDay + 7) % 7
          nextDate.setDate(nextDate.getDate() + dayOffset)
          break
        }
        case 'monthly': {
          const currentDate = nextDate.getDate()
          const date = dates.find(date => date >= currentDate) ?? dates[0] ?? 1
          const goToNextMonth = date < currentDate
          nextDate.setDate(date)
          if (goToNextMonth) {
            nextDate.setMonth(nextDate.getMonth() + 1)
          }
          break
        }
      }
      break
    }
  }
  return utcDateToLocalDate(nextDate)
}

/** The next scheduled execution date of given {@link ProjectExecution}. */
export function nextProjectExecutionDate(projectExecution: ProjectExecution, date: Date): Date {
  const nextDate = localDateToUtcDate(date)
  const {
    repeatInterval,
    time: { minute, hours = [], dates = [], days = [] },
  } = projectExecution
  nextDate.setMinutes(minute)
  switch (repeatInterval) {
    case 'hourly': {
      nextDate.setHours(nextDate.getHours() + 1)
      break
    }
    case 'daily':
    case 'weekly':
    case 'monthly': {
      const nextIndex = (hours.indexOf(nextDate.getHours()) + 1) % hours.length
      const hour = hours[nextIndex]
      const goToNextDay = hour == null || hour <= nextDate.getHours()
      nextDate.setHours(hour ?? 0)
      if (goToNextDay) {
        switch (repeatInterval) {
          case 'daily': {
            nextDate.setDate(nextDate.getDate() + 1)
            break
          }
          case 'weekly': {
            const dayIndex = (days.indexOf(nextDate.getDay()) + 1) % days.length
            const day = days[dayIndex] ?? 0
            // Wrap to 1-7 range instead of 0-6.
            const dayOffset = ((day - nextDate.getDay() + 6) % 7) + 1
            nextDate.setDate(nextDate.getDate() + dayOffset)
            break
          }
          case 'monthly': {
            const dateIndex = (dates.indexOf(nextDate.getDate()) + 1) % dates.length
            const date = dates[dateIndex] ?? 0
            const goToNextMonth = date <= nextDate.getDate()
            nextDate.setDate(date)
            if (goToNextMonth) {
              nextDate.setMonth(nextDate.getMonth() + 1)
            }
            break
          }
        }
      }
      break
    }
  }
  return utcDateToLocalDate(nextDate)
}

/**
 * All executions of the given {@link ProjectExecution} between the given dates.
 * By default, return an empty array if the {@link ProjectExecution} repeats hourly.
 * This is to prevent UI from being overly cluttered.
 */
export function getProjectExecutionRepetitionsForDateRange(
  projectExecution: ProjectExecution,
  startDate: Date,
  endDate: Date,
  options: GetProjectExecutionRepetitionsForDateRangeOptions = {},
): readonly Date[] {
  const { includeHourlyRepeats = false } = options
  if (!includeHourlyRepeats && projectExecution.repeatInterval === 'hourly') {
    return EMPTY_ARRAY
  }
  const firstDate = firstProjectExecutionOnOrAfter(projectExecution, startDate)
  if (firstDate >= endDate) {
    return EMPTY_ARRAY
  }
  const repetitions: Date[] = [firstDate]
  let currentDate = firstDate
  currentDate = nextProjectExecutionDate(projectExecution, currentDate)
  while (currentDate < endDate) {
    repetitions.push(currentDate)
    currentDate = nextProjectExecutionDate(projectExecution, currentDate)
  }
  return repetitions
}
