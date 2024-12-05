import { EMPTY_ARRAY } from '../../utilities/data/array'
import { ProjectExecution } from '../Backend'

const DAYS_PER_WEEK = 7
const MONTHS_PER_YEAR = 12

/** The first execution date of the given {@link ProjectExecution} on or after the given date. */
export function firstProjectExecutionOnOrAfter(
  projectExecution: ProjectExecution,
  startDate: Date,
): Date {
  // TODO: Account for timezone.
  const nextDate = startDate
  const { repeat } = projectExecution
  nextDate.setMinutes(repeat.minute)
  switch (repeat.type) {
    case 'hourly': {
      if (nextDate < startDate) {
        nextDate.setHours(nextDate.getHours() + 1)
      }
      const currentHours = nextDate.getHours()
      if (currentHours < repeat.startHour || currentHours > repeat.endHour) {
        nextDate.setHours(repeat.startHour)
        nextDate.setDate(nextDate.getDate() + 1)
      }
      break
    }
    case 'daily': {
      const currentDay = nextDate.getDay()
      const day = repeat.daysOfWeek.find(day => day >= currentDay) ?? repeat.daysOfWeek[0] ?? 0
      const dayOffset = (day - currentDay + DAYS_PER_WEEK) % DAYS_PER_WEEK
      nextDate.setDate(nextDate.getDate() + dayOffset)
      break
    }
    case 'monthly-weekday': {
      const currentDate = nextDate.getDate()
      nextDate.setDate(1)
      nextDate.setDate(1 + repeat.weekNumber * DAYS_PER_WEEK)
      const currentDay = nextDate.getDay()
      const dayOffset = (repeat.dayOfWeek - currentDay + 7) % 7
      nextDate.setDate(nextDate.getDate() + dayOffset)
      if (nextDate.getDate() < currentDate) {
        nextDate.setDate(1)
        nextDate.setMonth(nextDate.getMonth() + 1)
        nextDate.setDate(1 + repeat.weekNumber * DAYS_PER_WEEK)
        const currentDay = nextDate.getDay()
        const dayOffset = (repeat.dayOfWeek - currentDay + 7) % 7
        nextDate.setDate(nextDate.getDate() + dayOffset)
      }
      break
    }
    case 'monthly-date': {
      const currentDate = nextDate.getDate()
      const date = repeat.date
      const goToNextMonth = date < currentDate
      nextDate.setDate(date)
      if (goToNextMonth) {
        const startMonth = nextDate.getMonth()
        nextDate.setMonth(startMonth + 1)
        if ((nextDate.getMonth() + MONTHS_PER_YEAR - startMonth) % MONTHS_PER_YEAR > 1) {
          nextDate.setDate(0)
        }
      }
      break
    }
  }
  return nextDate
}

/** The next scheduled execution date of given {@link ProjectExecution}. */
export function nextProjectExecutionDate(projectExecution: ProjectExecution, date: Date): Date {
  // TODO: Account for timezone.
  const nextDate = date
  const { repeat } = projectExecution
  nextDate.setMinutes(repeat.minute)
  switch (repeat.type) {
    case 'hourly': {
      nextDate.setHours(nextDate.getHours() + 1)
      const currentHours = nextDate.getHours()
      if (currentHours < repeat.startHour || currentHours > repeat.endHour) {
        nextDate.setHours(repeat.startHour)
        nextDate.setDate(nextDate.getDate() + 1)
      }
      break
    }
    case 'daily': {
      const currentDay = nextDate.getDay()
      const day = repeat.daysOfWeek.find(day => day > currentDay) ?? repeat.daysOfWeek[0] ?? 0
      const dayOffset = (day - currentDay + 7) % 7
      nextDate.setDate(nextDate.getDate() + dayOffset)
      break
    }
    case 'monthly-weekday': {
      nextDate.setDate(1)
      nextDate.setMonth(nextDate.getMonth() + 1)
      nextDate.setDate(1 + repeat.weekNumber * DAYS_PER_WEEK)
      const currentDay = nextDate.getDay()
      const dayOffset = (repeat.dayOfWeek - currentDay + 7) % 7
      nextDate.setDate(nextDate.getDate() + dayOffset)
      break
    }
    case 'monthly-date': {
      const startMonth = nextDate.getMonth()
      nextDate.setMonth(startMonth + 1)
      if ((nextDate.getMonth() + MONTHS_PER_YEAR - startMonth) % MONTHS_PER_YEAR > 1) {
        nextDate.setDate(0)
      }
      break
    }
  }
  return nextDate
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
): readonly Date[] {
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
