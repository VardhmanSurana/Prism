/**
 * formatDate - Formats format date.
 */
export const formatDate = (dateString: string) => {
  if (!dateString || dateString === 'Invalid Date' || dateString === 'NaN') {
    return {
      dayName: 'Undated',
      fullDate: 'Unknown Date',
      year: new Date().getFullYear(),
    };
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return {
      dayName: 'Undated',
      fullDate: 'Unknown Date',
      year: new Date().getFullYear(),
    };
  }
  return {
    dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
    fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    year: date.getFullYear(),
  };
};
