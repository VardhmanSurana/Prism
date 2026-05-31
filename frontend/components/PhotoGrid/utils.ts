export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
    fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    year: date.getFullYear(),
  };
};
