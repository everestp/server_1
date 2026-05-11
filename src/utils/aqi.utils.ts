export function getAQIInfo(aqi: number) {
  if (aqi <= 50) {
    return {
      label: "Good",
      color: "#4ADE80",
    };
  }

  if (aqi <= 100) {
    return {
      label: "Moderate",
      color: "#FACC15",
    };
  }

  if (aqi <= 150) {
    return {
      label: "Sensitive",
      color: "#FB923C",
    };
  }

  if (aqi <= 200) {
    return {
      label: "Unhealthy",
      color: "#F87171",
    };
  }

  if (aqi <= 300) {
    return {
      label: "Very Unhealthy",
      color: "#C084FC",
    };
  }

  return {
    label: "Hazardous",
    color: "#DC2626",
  };
}
