// Thin report wrapper around the shared map-pin picker panel.
import React from 'react';
import LocationPickerModal, {
  LocationPickerPanel,
  type LocationPickerPanelProps,
} from '../map/LocationPickerModal';
import type { GpsPosition } from '../../lib/location';

type Props = {
  visible?: boolean;
  embedded?: boolean;
  incidentPosition: GpsPosition;
  devicePosition?: GpsPosition;
  maximumDistanceMeters?: number;
  onConfirm: (position: GpsPosition) => void;
  onClose: () => void;
};

export default function ReportLocationPicker({
  visible = false,
  embedded = false,
  incidentPosition,
  devicePosition,
  maximumDistanceMeters,
  onConfirm,
  onClose,
}: Props) {
  const pickerProps: LocationPickerPanelProps = {
    initialCoordinate: incidentPosition,
    referenceCoordinate: devicePosition,
    maximumDistanceMeters,
    title: 'Adjust incident pin',
    hint: devicePosition
      ? 'Move the map until the fixed pin is over the incident. The small dot is your verified device location.'
      : 'Move the map until the fixed pin is over the incident location.',
    confirmLabel: 'Use incident pin',
    onConfirm: (coordinate) =>
      onConfirm({
        ...coordinate,
        // A manual map placement preserves the GPS accuracy metadata for reports.
        accuracyMeters:
          devicePosition?.accuracyMeters ?? incidentPosition.accuracyMeters,
      }),
    onClose,
  };

  if (embedded) {
    return <LocationPickerPanel {...pickerProps} embedded />;
  }

  return <LocationPickerModal {...pickerProps} visible={visible} />;
}
