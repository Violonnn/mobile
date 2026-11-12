import React from 'react';

import type { MapReportMarker, ReportStatusPresentation } from '../../lib/reports';
import ResidentMapCallout from './ResidentMapCallout';

type Props = {
  report: MapReportMarker;
  statusPresentation?: Pick<ReportStatusPresentation, 'label' | 'color' | 'backgroundColor'> | null;
  bottomOffset: number;
  onClose: () => void;
  onOpenDetails: () => void;
};

/** Compatibility wrapper for official map callers using the resident callout shell. */
export default function HighlightedReportCallout({
  report,
  statusPresentation,
  bottomOffset,
  onClose,
  onOpenDetails,
}: Props) {
  return (
    <ResidentMapCallout
      report={report}
      statusPresentation={statusPresentation ?? undefined}
      bottomOffset={bottomOffset}
      onClose={onClose}
      onOpenDetails={onOpenDetails}
    />
  );
}
