export const formatTimestamp = (timestamp: string) => {
    // Expected format: YYYY-MM-DD_HH-MM-SS
    // Or ISO string, but the recorder uses YYYY-MM-DD_HH-MM-SS
    const parts = timestamp.split('_');
    if (parts.length === 2) {
        const dateParts = parts[0].split('-');
        const timeParts = parts[1].split('-');
        const date = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
            parseInt(timeParts[0]),
            parseInt(timeParts[1]),
            parseInt(timeParts[2])
        );
        return date.toLocaleString();
    }
    return new Date(timestamp).toLocaleString();
};
