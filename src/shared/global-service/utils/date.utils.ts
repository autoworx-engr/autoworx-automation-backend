import * as moment from 'moment';

export class DateUtils {
  skippingWeekends(
    startDate: Date,
    endDate: Date,
    weekendConfig: { weekend1: number; weekend2: number },
  ): Date {
    console.log('startDate', startDate);
    console.log('endDate', endDate);
    const start = moment(startDate); // Add one day to include the start date in the range
    const end = moment(endDate); // Add one day to include the end date in the range
    // Count how many weekend days are in the range
    const current = start.clone();
    let weekendCount = 0;

    while (current.isSameOrBefore(endDate, 'day')) {
      const day = current.day(); // 0 = Sunday, 6 = Saturday
      if (day === weekendConfig.weekend1 || day === weekendConfig.weekend2) {
        weekendCount++;
      }
      current.add(1, 'day');
    }

    // Add that many days to the endDate
    if (weekendCount > 0) {
      end.add(weekendCount, 'days');
    }
    console.log('weekendCount', weekendCount);
    console.log('executeDate', end.toDate());
    return end.toDate();
  }
}
