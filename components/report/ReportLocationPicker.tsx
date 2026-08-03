// Thin report wrapper around the shared map-pin picker.
import React from 'react';
import LocationPickerModal from '../map/LocationPickerModal';
import type { GpsPosition } from '../../lib/location';

type Props = {
  visible: boolean;
  initialPosition: GpsPosition;
  onConfirm: (position: GpsPosition) => void;
  onClose: () => void;
};

export default function ReportLocationPicker({
  visible,
  initialPosition,
  onConfirm,
  onClose,
}: Props) {
  return (
    <LocationPickerModal
      visible={visible}
      initialCoordinate={initialPosition}
      title="Confirm location"
      hint="Drag the pin or tap the map to mark where the incident is happening."
      onConfirm={(coordinate) =>
        onConfirm({
          ...coordinate,
          // A manual map placement preserves the GPS accuracy metadata for reports.
          accuracyMeters: initialPosition.accuracyMeters,
        })
      }
      onClose={onClose}
    />
  );
}
