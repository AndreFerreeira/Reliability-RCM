'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogEvent } from '@/lib/types';
import { useI18n } from '@/i18n/i18n-provider';

interface EventLogTableProps {
  events: LogEvent[];
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    let parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
    if (parts) {
        const [, day, month, year, hour, minute] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }
    parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
        const [, day, month, year] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
}

export default function EventLogTable({ events }: EventLogTableProps) {
  const { t } = useI18n();

  const processedEvents = React.useMemo(() => {
    if (!events || events.length === 0) {
      return [];
    }

    const allParsedEvents = events
      .map((e) => ({ ...e, startDateObj: parseDate(e.startDate), endDateObj: parseDate(e.endDate) }))
      .filter((e): e is LogEvent & { startDateObj: Date, endDateObj: Date | null } => !!e.startDateObj)
      .sort((a, b) => a.startDateObj!.getTime() - b.startDateObj!.getTime());

    return allParsedEvents.map((event, index) => {
      let timeToRepair: number | undefined = undefined;
      if (event.endDateObj && event.startDateObj) {
        timeToRepair = (event.endDateObj.getTime() - event.startDateObj.getTime()) / (1000 * 60 * 60);
      }

      let timeBetweenFailures: number | undefined = undefined;
      if (event.status === 'FALHA') {
        let prevFailureEvent: (LogEvent & { startDateObj: Date, endDateObj: Date | null }) | undefined = undefined;

        // Search backwards from the current event to find the previous failure
        for (let i = index - 1; i >= 0; i--) {
            if (allParsedEvents[i].status === 'FALHA') {
                prevFailureEvent = allParsedEvents[i];
                break;
            }
        }
        
        if (prevFailureEvent && prevFailureEvent.endDateObj) {
            timeBetweenFailures = (event.startDateObj.getTime() - prevFailureEvent.endDateObj.getTime()) / (1000 * 60 * 60);
        }
      }

      return { ...event, timeToRepair, timeBetweenFailures };
    });
  }, [events]);

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('assetDetail.eventLog.title')}</CardTitle>
        <CardDescription>{t('assetDetail.eventLog.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <TableRow>
                <TableHead>{t('assetDetail.eventLog.tag')}</TableHead>
                <TableHead>{t('assetDetail.eventLog.startDate')}</TableHead>
                <TableHead>{t('assetDetail.eventLog.endDate')}</TableHead>
                <TableHead>{t('assetDetail.eventLog.descriptionLabel')}</TableHead>
                <TableHead className="text-right">{t('assetDetail.eventLog.tef')}</TableHead>
                <TableHead className="text-right">{t('assetDetail.eventLog.tr')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedEvents.map((event, index) => (
                <TableRow key={index}>
                  <TableCell>{event.tag}</TableCell>
                  <TableCell>{event.startDate}</TableCell>
                  <TableCell>{event.endDate}</TableCell>
                  <TableCell>{event.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    {event.timeBetweenFailures !== undefined ? event.timeBetweenFailures.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {event.timeToRepair !== undefined ? event.timeToRepair.toFixed(2) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
